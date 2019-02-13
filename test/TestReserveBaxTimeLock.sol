pragma solidity ^0.4.24;

import "truffle/Assert.sol";
import "truffle/DeployedAddresses.sol";
import "../contracts/ReserveBaxTimeLock.sol";

contract TestReserveBaxTimeLock {

  function testInitialBalanceUsingDeployedContract() public {
    ReserveBaxTimeLock timeLock = ReserveBaxTimeLock(DeployedAddresses.ReserveBaxTimeLock());

    uint expected = 10;
    uint expectedPercent = 2;

    Assert.equal(timeLock.getBlockRangeForWithdraw(), expected, "Default block range should be 10 initially");
    Assert.equal(timeLock.getPercentPerRange(), expectedPercent, "Default percentage should be 2 initially");
  }

}
