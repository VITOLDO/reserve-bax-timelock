const ReserveBaxTimeLock = artifacts.require("ReserveBaxTimeLock");
const BaxToken = artifacts.require("baxToken/BaxToken");

module.exports = function(deployer) {
    deployer.deploy(BaxToken).then(function() {
        return deployer.deploy(ReserveBaxTimeLock, BaxToken.address, 10, 2);
    });
};
