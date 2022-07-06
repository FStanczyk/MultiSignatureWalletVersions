const {expect} = require('chai');

describe('Multi Signature contract _light_version', ()=>{
    let MSLight, msLight, owner, addr1, addr2;

    //@note before each test, deploy new contract
    beforeEach(async ()=>{

        //@notice getContractFactory creates token factory ('x') where x is the name of the contract (not file!)
        MSLight = await ethers.getContractFactory('MultiSigWallet_standard');
        
        //@note signers are able to sign transactions
        [owner, addr1, addr2, _]= await ethers.getSigners();

        let owners = [owner.address, addr1.address]
        //@note creating contract object
        msLight = await MSLight.deploy(owners, 2);


    })

    describe('Deployment, constructor arguments', ()=>{

        //@note test starts from 'it'
        it('should set right number of required approvals', async ()=>{
            expect(await msLight.approvalsRequired()).to.equal(2)
        })

        it('should set right owners', async ()=>{
            expect(await msLight.isOwner(owner.address)).to.be.true
            expect(await msLight.isOwner(addr1.address)).to.be.true
            expect(await msLight.isOwner(addr2.address)).to.be.false
        })
    })

    describe('Submit transaction correctness', ()=>{

        it('should submit correct transaction', async ()=>{
            await msLight.submitTransaction(addr1.address, 10, 0x1234)
            expect((await msLight.transactions(0)).to).to.equal('0x70997970C51812dc3A010C7d01b50e0d17dc79C8')
            expect((await msLight.transactions(0)).value).to.equal(10)
            expect((await msLight.transactions(0)).data).to.equal('0x1234')
            expect((await msLight.transactions(0)).executed).to.be.false
            expect((await msLight.transactions(0)).numApprovals).to.equal(0)
        })
    })

    describe('Approval process corectness', () => {
        it('should add 1 approval', async () => {
            await msLight.submitTransaction(addr1.address, 10, 0x1234)
            //@notice before approval should be 0
            expect((await msLight.transactions(0)).numApprovals).to.equal(0)
            await msLight.approveTransaction(0)

            //and after should be one
            expect((await msLight.transactions(0)).numApprovals).to.equal(1)

            expect((await msLight.isApproved(0, owner.address))).to.be.true
        })

        it('should not allow not-owners to approve', async () => {
            await msLight.submitTransaction(addr1.address, 10, 0x1234)

            await expect (msLight.connect(addr2).approveTransaction(0)).to.be.revertedWith('not owner')
        })
    
    })

    describe('Execution of transaction correctness', () => {
        it('should not allow to execute a transaction without enough approvals', async () => {
            await msLight.submitTransaction(addr1.address, 10, 0x1234)
            await msLight.approveTransaction(0)
            await expect(msLight.executeTransaction(0)).to.be.revertedWith('cannot execute tx')
        })
        it('should  allow to execute a transaction with enough approvals', async () => {
            await msLight.submitTransaction(addr1.address, 10, 0x1234)
            await msLight.approveTransaction(0)
            await msLight.connect(addr1).approveTransaction(0)
            await expect(msLight.executeTransaction(0)).to.not.be.reverted
        })

        it('should not execute non existing transaction', async () => {
            await expect(msLight.executeTransaction(2)).to.be.revertedWith('tx does not exist')
        })

    })

    describe('Recvoke Transaction correctness', () => {
        it('should not allow to revoke when: msg.sender is not an owner, trnsaction does not exist or trnsaction is already executed', async () => {
            await msLight.submitTransaction(addr1.address, 10, 0x1234)
            await expect (msLight.connect(addr2).revokeApproval(0)).to.be.revertedWith('not owner')
            await expect (msLight.revokeApproval(1)).to.be.revertedWith('tx does not exist')
            await msLight.approveTransaction(0)
            await msLight.connect(addr1).approveTransaction(0)
            await msLight.executeTransaction(0)
            await expect (msLight.revokeApproval(0)).to.be.revertedWith('tx already executed')
        })

        it('should successfully remove approval', async () => {
            await msLight.submitTransaction(addr1.address, 10, 0x1234)
            await msLight.approveTransaction(0)
            expect((await msLight.transactions(0)).numApprovals).to.equal(1)
            await msLight.revokeApproval(0)
            expect((await msLight.transactions(0)).numApprovals).to.equal(0)

        })
    })
})