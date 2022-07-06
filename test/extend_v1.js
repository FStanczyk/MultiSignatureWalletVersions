const {expect} = require('chai');


describe('Multi Signature contract _extended_version', ()=>{
    let MSExtended, msExtended, admin, addr1, addr2, addr3;
    let permittedUsers
    let requiredApprovals
    beforeEach(async ()=>{   
        MSExtended = await ethers.getContractFactory('multiSigWallet_extend_v1');

        [admin, addr1, addr2, addr3, _]= await ethers.getSigners();

        //@notice we don't put owner into the constructor argument 
        //array because he will automatically become a permitted user (admin)
        permittedUsers = [addr1.address, addr2.address]
        requiredApprovals = 2

        msExtended = await MSExtended.deploy(permittedUsers, requiredApprovals)
        })

        describe('Deployment and constructor', () => {
            
            it('should set correct number of permittedUsers', async () =>{
                expect (await msExtended.permittedUsers()).to.equal(permittedUsers.length+1)
            })

            it('should set correct number of required approvals', async () =>{
                expect (await msExtended.requirements()).to.equal(requiredApprovals)
            })
        })

        describe('submitting a transaction', () =>{

            it('should submit a transaction with correct parameters', async () =>{
                await msExtended.submitTransaction(addr2.address, 10, '0x1234')
                expect((await msExtended.TXPool(0)).to).to.equal(addr2.address)
                expect((await msExtended.TXPool(0)).value).to.equal(10)
                expect((await msExtended.TXPool(0)).data).to.equal('0x1234')
                expect((await msExtended.TXPool(0)).executed).to.be.false
                expect((await msExtended.TXPool(0)).numApprovals).to.equal(0)
                expect((await msExtended.TXPool(0)).denied).to.be.false
                let r = await msExtended.requirements()
                expect((await msExtended.TXPool(0)).requiredApprovals).to.equal(r)
            })

            it('should revert when not permitted users tries to submit', async () => {
                await expect ( msExtended.connect(addr3).submitTransaction(addr2.address, 10, '0x1234'))
                .to.be.revertedWith('only permittedUsers')
            })
        })

        describe('Approval correctness', () => {
            it('should add 1 approval', async () => {
                await msExtended.submitTransaction(addr1.address, 10, 0x1234)
                //@notice before approval should be 0
                expect((await msExtended.TXPool(0)).numApprovals).to.equal(0)
                await msExtended.approveTransaction(0)
    
                //and after should be one
                expect((await msExtended.TXPool(0)).numApprovals).to.equal(1)
    
                expect((await msExtended.isApproved(0, admin.address))).to.be.true
            })

            it('should not allow not permitted users to approve', async () => {
                await msExtended.submitTransaction(addr1.address, 10, 0x1234)
    
                await expect (msExtended.connect(addr3).approveTransaction(0)).to.be.revertedWith('only permittedUsers')
            })

            it('should not allow to approve non-existing transaction', async () => {
                await expect (msExtended.approveTransaction(1)).to.be.revertedWith('tx does not exist')
            })

            it('should not allow to approve already executed transaction', async () => {
                await msExtended.submitTransaction(addr1.address, 10, 0x1234)
                await msExtended.approveTransaction(0)
                await msExtended.connect(addr1).approveTransaction(0)
                await msExtended.executeTransaction(0)

                await expect (msExtended.approveTransaction(0)).to.be.revertedWith('tx already executed')
            })
        })

        describe('Execution of transaction correctness', () => {
            it('should not allow to execute a transaction without enough approvals', async () => {
                await msExtended.submitTransaction(addr1.address, 10, 0x1234)
                await msExtended.approveTransaction(0)
                await expect(msExtended.executeTransaction(0)).to.be.revertedWith('cannot execute tx')
            })
            it('should  allow to execute a transaction with enough approvals', async () => {
                await msExtended.submitTransaction(addr1.address, 10, 0x1234)
                await msExtended.approveTransaction(0)
                await msExtended.connect(addr1).approveTransaction(0)
                await expect(msExtended.executeTransaction(0)).to.not.be.reverted
            })
    
            it('should not execute non existing transaction', async () => {
                await expect(msExtended.executeTransaction(2)).to.be.revertedWith('tx does not exist')
            })
        })

        describe('Recvoke Transaction correctness', () => {
            it('should not allow to revoke when: msg.sender is not an owner, trnsaction does not exist or trnsaction is already executed', async () => {
                await msExtended.submitTransaction(addr1.address, 10, 0x1234)
                await expect (msExtended.connect(addr2).revokeApproval(0)).to.be.revertedWith("tx not approved")
                await expect (msExtended.revokeApproval(1)).to.be.revertedWith('tx does not exist')
                await msExtended.approveTransaction(0)
                await msExtended.connect(addr1).approveTransaction(0)
                await msExtended.executeTransaction(0)
                await expect (msExtended.revokeApproval(0)).to.be.revertedWith('tx already executed')
            })
    
            it('should successfully remove approval', async () => {
                await msExtended.submitTransaction(addr1.address, 10, 0x1234)
                await msExtended.approveTransaction(0)
                expect((await msExtended.TXPool(0)).numApprovals).to.equal(1)
                await msExtended.revokeApproval(0)
                expect((await msExtended.TXPool(0)).numApprovals).to.equal(0)
    
            })
        })

        describe('Adding and removing permissions', () => {
            it('should succesfully add new users', async () => {
                let before = (await msExtended.permittedUsers())
                expect(before = permittedUsers.length + 1)
                await msExtended.addUser(addr3.address)
                console.log('Users before: '+before)
                console.log('Users after:  '+await msExtended.permittedUsers())
                expect (await msExtended.permittedUsers()).to.equal(permittedUsers.length+2)
            })

            it('should succesfully remove users', async () => {
                console.log('User addr1 can easily submit a transaction')
                await expect(msExtended.connect(addr1).submitTransaction(addr2.address, 10, '0x1234'))
                .to.not.be.reverted

                console.log('User addr1 is being removed from permitted users')
                await msExtended.removeUser(addr1.address)

                console.log('User addr2 should not be able to submit tx`s anymore')
                await expect(msExtended.connect(addr1).submitTransaction(addr2.address, 10, '0x1234'))
                .to.be.revertedWith('only permittedUsers')
            })

            it('only admin should be able to add or remove users', async () => {
                await expect(msExtended.connect(addr3).addUser(addr3.address)).to.be.revertedWith('only admin')
                await expect(msExtended.connect(addr3).removeUser(addr3.address)).to.be.revertedWith('only admin')
            })
        })
    
        describe('Changing requirements', () => {
            it.only('should change requirements',async () => {
                await msExtended.submitTransaction(addr2.address, 10, '0x1234')
                let r = await msExtended.requirements()
                expect((await msExtended.TXPool(0)).requiredApprovals).to.equal(r)
                await msExtended.changeRequirements(3)
                r = await msExtended.requirements()
                await msExtended.submitTransaction(addr3.address, 10, '0x1234')
                expect((await msExtended.TXPool(1)).requiredApprovals).to.equal(r)
            })
        })
})