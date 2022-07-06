// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

//In this version: exists one Admin whose permission is crucial. His disapproval is absolute and completely denies TX.
//Admin is able to add new users and change required number of approvals.
contract multiSigWallet_extend_v1{
    event Deposit(address indexed user, uint amount, uint balance);
    event SubmitTransaction(address indexed user, uint id, address indexed to, uint value, bytes data);
    event Approve(address indexed user, uint id);
    event Revoke(address indexed user, uint id);
    event AdminDisapproval(uint id);
    event Execute(address indexed user, uint id);
    event ExecutionFailed(address indexed user, uint indexed id);
    event ChangeRequirements(uint newRequirements);
    event UserAdded(address indexed user);
    address public admin;


    // @notice instead of `address[] public permittedUsers;` we use the line below for easier managmenent of removing and adding users
    // it would cost more gas to delete certain address from aray than decrementing an uint.
    // However we are not able to check whole list of permitted users.
    uint public permittedUsers;

    struct Transaction {
        address to;
        uint value;
        bytes data;
        bool executed;
        bool denied;
        uint numApprovals;
        uint requiredApprovals;
    }
    Transaction[] public TXPool;
    mapping(address=>bool) public isPermitted;
    mapping(uint=>mapping(address=>bool)) public isApproved;
    uint public requirements;
    uint public balance;

    modifier onlyAdmin(){
        require(msg.sender == admin, "only admin");
        _;
    }
    modifier onlyPermittedUsers(){
        require(isPermitted[msg.sender] == true, "only permittedUsers");
        _;
    }
    modifier txExists(uint _txIndex) {
        require(_txIndex < TXPool.length, "tx does not exist");
        _;
    }

    modifier notExecuted(uint _txIndex) {
        require(!TXPool[_txIndex].executed, "tx already executed");
        _;
    }
    modifier notDenied(uint _txIndex) {
        require(!TXPool[_txIndex].denied, "tx denied by admin");
        _;
    }
    modifier notApproved(uint _txIndex) {
        require(!isApproved[_txIndex][msg.sender], "tx already approved");
        _;
    }

    constructor(address[] memory initialPermittedUsers, uint defaultRequirements){
        require(defaultRequirements <= initialPermittedUsers.length, "impossible requirement");
        admin = msg.sender;
        isPermitted[admin] = true;
        permittedUsers = 1;//@notice = ; because admin (creator of the contract) is always the first permitted user;

        for(uint i = 0; i < initialPermittedUsers.length; i++){
            address user = initialPermittedUsers[i];
            require(user != address(0), "invalid user");
            require(!isPermitted[user], "user not unique"); 
            isPermitted[user] = true;
            permittedUsers++;
        }
        requirements = defaultRequirements;
    }

    receive() external payable {
        balance = balance + msg.value;
        emit Deposit(msg.sender, msg.value, balance);
    }


    function submitTransaction(address to, uint value, bytes memory data) public onlyPermittedUsers{
        uint txID = TXPool.length;
         TXPool.push(
            Transaction({
                to: to,
                value: value,
                data: data,
                executed: false,
                numApprovals: 0,
                denied: false,
                requiredApprovals: requirements
            })
        );
        emit SubmitTransaction(msg.sender, txID, to, value, data);
    }


    function approveTransaction(uint txID) 
        public  
        onlyPermittedUsers
        txExists(txID)
        notExecuted(txID)
        notApproved(txID)
        notDenied(txID)
        {
        TXPool[txID].numApprovals++;
        isApproved[txID][msg.sender] = true;

        emit Approve(msg.sender, txID);
    }

    function executeTransaction(uint txID) 
    public onlyPermittedUsers txExists(txID) notExecuted(txID) notDenied(txID) 
    {
        require(
            TXPool[txID].numApprovals >= TXPool[txID].requiredApprovals,
            "cannot execute tx"
        );
        TXPool[txID].executed = true;
        (bool success, )=TXPool[txID].to.call{value: TXPool[txID].value}(TXPool[txID].data);
        if(success == true)   emit Execute(msg.sender, txID);
        else emit ExecutionFailed(msg.sender, txID);
    }


    function revokeApproval(uint txID) 
    public onlyPermittedUsers txExists(txID) notExecuted(txID) notDenied(txID)
    {
        require(isApproved[txID][msg.sender], "tx not approved");
        TXPool[txID].numApprovals -= 1;
        isApproved[txID][msg.sender] = false;

        emit Revoke(msg.sender, txID);
    }


    function denyTransaction(uint txID)
    public onlyAdmin notExecuted(txID) notDenied(txID) txExists(txID){
        TXPool[txID].denied = true;
    }


    function addUser(address newUser) public onlyAdmin{
        require(!isPermitted[newUser], "user already permitted");
        require(newUser != address(0), "user invalid");
        isPermitted[newUser] = true;
        permittedUsers++;

        emit UserAdded(newUser);
    }


    function removeUser(address newUser) public onlyAdmin{
        require(isPermitted[newUser], "user already not permitted");
        isPermitted[newUser] = false;
        permittedUsers--;
    }


    function changeRequirements(uint newRequirements) public onlyAdmin{
        require(newRequirements <= permittedUsers, "impossible requirement");
        requirements = newRequirements;
    }
}
