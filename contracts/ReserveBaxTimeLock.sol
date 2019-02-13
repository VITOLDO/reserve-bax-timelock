pragma solidity ^0.4.24;

import "openzeppelin-solidity/contracts/token/ERC20/ERC20.sol";
import "./Owned.sol";

// This is just a simple example of a coin-like contract.
// It is not standards compatible and cannot be expected to talk to other
// coin/token contracts. If you want to create a standards-compliant
// token, see: https://github.com/ConsenSys/Tokens. Cheers!

contract ReserveBaxTimeLock is Owned {

	mapping (address => Deposit[]) private deposits;
	mapping (address => uint) private totalDeposits;
	address private erc20address;
	uint private blockRangeForWithdraw;
	uint private percentPerRange;

	uint private totalDeposited;

	ERC20 public ERC20Interface;

	struct Deposit {
		uint amount_;
		uint sent_;
		uint startingTime_;
	}
	event LogDebug(uint value1, uint value2, uint value3);

	event LogDepositPlaced(address indexed _from, address indexed _recipient, uint _amount, uint _blockStart);
	event LogDepositWithdraw(address indexed _recipient, uint _amount);

	constructor(address _erc20address, uint _blockRangeForWithdraw, uint _percentPerRange) public {
		require(_erc20address != address(0));
		blockRangeForWithdraw = _blockRangeForWithdraw;
		percentPerRange = _percentPerRange;
		erc20address = _erc20address;
	}

	function depositCoin(address recipient, uint amount, uint delayTime) public fromOwner returns(bool success) {
		require(amount > 0);
		require((amount * percentPerRange % 10000) == 0);
		require(recipient != address(0));
		require(ERC20(erc20address).balanceOf(address(this)) >= (totalDeposited + amount));

		totalDeposited += amount;

		// schedule BAX that needs to be transferred
		deposits[recipient].push(Deposit({amount_: amount, sent_: 0, startingTime_: block.timestamp + delayTime}));
		totalDeposits[recipient] += amount;

		emit LogDepositPlaced(msg.sender, recipient, amount, block.timestamp + delayTime);

		return true;
	}

	function withdraw() public returns(bool success){
		require(totalDeposits[msg.sender] > 0);

		// calculate how much should be sent to recipient
		uint amountToSend = 0;
		for (uint i = 0; deposits[msg.sender].length > i; i++) {
			Deposit storage deposit = deposits[msg.sender][i];
			uint times = uint ((block.timestamp - deposit.startingTime_) / blockRangeForWithdraw);
			if (block.timestamp > deposit.startingTime_ && deposit.sent_ < deposit.amount_) {
				uint percentToBeSent = percentPerRange * times;

				if ( percentToBeSent > 10000) {
					percentToBeSent = 10000; // 10000 means 100.00 %
				}
				amountToSend += (deposit.amount_ * percentToBeSent / 10000) - deposit.sent_;
				deposit.sent_ += amountToSend;
			}
		}

		// send BAX to recipient
		ERC20(erc20address).transfer(msg.sender, amountToSend);
		totalDeposited -= amountToSend;

		emit LogDepositWithdraw(msg.sender, amountToSend);

		return true;
	}

	function getBlockRangeForWithdraw() public view returns(uint) {
		return blockRangeForWithdraw;
	}

	function getPercentPerRange() public view returns(uint) {
		return percentPerRange;
	}
}
