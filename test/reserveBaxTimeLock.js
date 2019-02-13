const ReserveBaxTimeLock = artifacts.require("ReserveBaxTimeLock");
const BaxToken = artifacts.require("baxToken/BaxToken");

const { increaseTime } = require("../util/timeTraveler.js");
const DAY = 3600 * 24;

const Promise = require("bluebird");
Promise.allSeq = require("../util/sequentialPromise.js");
Promise.allNamed = require("../util/sequentialPromiseNamed.js");

const expectedExceptionPromise = require("../util/expectedException.js");

contract('ReserveBaxTimeLock', (accounts) => {

    let owner, baxTokenInstance, reserveBaxTimeLockInstance, recipient, stranger, timeRange, percentPerRange;

    before("should prepare", function() {
        assert.isAtLeast(accounts.length, 2);
        owner = accounts[0];
        recipient = accounts[1];
        stranger = accounts[2];
        timeRange = 10;
        percentPerRange = 2; // this will be 0.02%
    });

    beforeEach("should deploy a new contracts and mint few tokens on it ", async () => {
        baxTokenInstance = await BaxToken.new({from: owner});
        reserveBaxTimeLockInstance = await ReserveBaxTimeLock.new(baxTokenInstance.address, timeRange, percentPerRange, {from: owner});

        await baxTokenInstance.mint(reserveBaxTimeLockInstance.address, 20000, {from: owner});

        const contractBAX = (await baxTokenInstance.balanceOf.call(reserveBaxTimeLockInstance.address, {from: owner})).toNumber();

        assert.equal(20000, contractBAX, "Tokens wasn't transferred to contract");
    });

    it('should put 10 as a default block range and 2 as a default percent per range', async () => {
        const range = (await reserveBaxTimeLockInstance.getBlockRangeForWithdraw.call({from: accounts[0]})).toNumber();
        const percent = (await reserveBaxTimeLockInstance.getPercentPerRange.call({from: accounts[0]})).toNumber();

        assert.equal(range, timeRange, "10 wasn't set as a timeRange");
        assert.equal(percent, percentPerRange, "2 wasn't set as a percent per range");
    });

    it('should be able to place deposit', () => {
        return reserveBaxTimeLockInstance.depositCoin(recipient, 5000, 10, {from: owner})
            .then(tx => {
                assert.strictEqual(tx.receipt.logs.length, 1);
                assert.strictEqual(tx.logs.length, 1);
                const logChanged = tx.logs[0];
                assert.strictEqual("LogDepositPlaced",  logChanged.event);
                assert.strictEqual(owner,               logChanged.args._from);
                assert.strictEqual(recipient,           logChanged.args._recipient);
                assert.strictEqual(5000,                logChanged.args._amount.toNumber());
            });
    });

    it('withdraw before 1st unlock', () => {
        return reserveBaxTimeLockInstance.depositCoin(recipient, 5000, 10, {from: owner})
            .then(tx => {
                assert.strictEqual(tx.logs.length, 1);
                const logChanged = tx.logs[0];
                assert.strictEqual(logChanged.event, "LogDepositPlaced");

                return reserveBaxTimeLockInstance.withdraw({from: recipient})
            }).then(tx => {
                assert.strictEqual(1, tx.receipt.logs.length);
                assert.strictEqual(1, tx.logs.length);
                const logChanged = tx.logs[0];
                assert.strictEqual("LogDepositWithdraw",    logChanged.event);
                assert.strictEqual(recipient,               logChanged.args._recipient);
                assert.strictEqual(0,                       logChanged.args._amount.toNumber());

                return baxTokenInstance.balanceOf.call(recipient, {from: recipient});
            }).then(amount => {
                assert.strictEqual(0, amount.toNumber(), "Recipient shouldn't have received any tokens before 1st unlock");
            });
    });

    it('withdraw after 1st unlock', () => {
        return reserveBaxTimeLockInstance.depositCoin(recipient, 5000, 0, {from: owner})
            .then(tx => {
                assert.strictEqual(tx.logs.length, 1);
                const logChanged = tx.logs[0];
                assert.strictEqual(logChanged.event, "LogDepositPlaced");

                return reserveBaxTimeLockInstance.withdraw({from: recipient})
            }).then(async (tx) => {
                assert.strictEqual(1, tx.receipt.logs.length);
                assert.strictEqual(1, tx.logs.length);
                const logChanged = tx.logs[0];
                assert.strictEqual("LogDepositWithdraw",    logChanged.event);
                assert.strictEqual(recipient,               logChanged.args._recipient);
                assert.strictEqual(0,                       logChanged.args._amount.toNumber());

                await increaseTime(timeRange);

                return reserveBaxTimeLockInstance.withdraw({from: recipient});
            }).then((tx) => {

                const recipientWithdraw = (5000 * percentPerRange) / 10000;
                const logChanged = tx.logs[0];
                assert.strictEqual("LogDepositWithdraw",    logChanged.event);
                assert.strictEqual(recipient,               logChanged.args._recipient);
                assert.strictEqual(recipientWithdraw,       logChanged.args._amount.toNumber());

                return Promise.allNamed({
                        type0: () => baxTokenInstance.balanceOf(recipient, {from: recipient}),
                        type1: () => baxTokenInstance.balanceOf(reserveBaxTimeLockInstance.address, {from: owner})
                    })
                    .then(multipliers => {
                        assert.strictEqual(multipliers.type0.toNumber(), recipientWithdraw, "Recipient should have received only 10 tokens after 1st unlock");
                        assert.strictEqual(multipliers.type1.toNumber(), 20000 - recipientWithdraw, "Contract balance should've been cutted by the amount of sent tokens to Recipient");
                    });
            });
    });

    it('withdraw after N times unlock', () => {
        const nTimes = 5;
        return reserveBaxTimeLockInstance.depositCoin(recipient, 5000, 0, {from: owner})
            .then(tx => {
                assert.strictEqual(tx.logs.length, 1);
                const logChanged = tx.logs[0];
                assert.strictEqual(logChanged.event, "LogDepositPlaced");

                return reserveBaxTimeLockInstance.withdraw({from: recipient})
            }).then(async (tx) => {
                assert.strictEqual(1, tx.receipt.logs.length);
                assert.strictEqual(1, tx.logs.length);
                const logChanged = tx.logs[0];
                assert.strictEqual("LogDepositWithdraw",    logChanged.event);
                assert.strictEqual(recipient,               logChanged.args._recipient);
                assert.strictEqual(0,                       logChanged.args._amount.toNumber());

                await increaseTime(timeRange * nTimes);

                return reserveBaxTimeLockInstance.withdraw({from: recipient});
            }).then((tx) => {

                const recipientWithdraw = (5000 * percentPerRange * nTimes) / 10000;
                const logChanged = tx.logs[0];
                assert.strictEqual("LogDepositWithdraw",    logChanged.event);
                assert.strictEqual(recipient,               logChanged.args._recipient);
                assert.strictEqual(recipientWithdraw,       logChanged.args._amount.toNumber());

                return Promise.allNamed({
                        type0: () => baxTokenInstance.balanceOf(recipient, {from: recipient}),
                        type1: () => baxTokenInstance.balanceOf(reserveBaxTimeLockInstance.address, {from: owner})
                    })
                    .then(multipliers => {
                        assert.strictEqual(multipliers.type0.toNumber(), recipientWithdraw, "Recipient should have received only 10 tokens after 1st unlock");
                        assert.strictEqual(multipliers.type1.toNumber(), 20000 - recipientWithdraw, "Contract balance should've been cutted by the amount of sent tokens to Recipient");
                    });
            });
    });


});
