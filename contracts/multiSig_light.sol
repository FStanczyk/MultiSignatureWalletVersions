// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

//Standard version (initial code provided thanks to @ProgrammerSmart tutorial):
//Owners are defined in constructor, each owner has the same power/permissions.
//required number of approval is constant and defined by constructor parameter.
contract MultiSigWallet_standard{

    //Declaration of events

    //@param sender of the deposit and amount of the deposit.
    //@optional we can add parameter uint balance to give 
    //information about current balance
    event Deposit(address indexed sender, uint amount);

    //@param
    //owner - address of the owner who submited transaction
    //txID - index of this transaction in the array of tx's
    event SubmitTransaction(
            address indexed owner,
            uint indexed txID,
            address indexed to,
            uint value,
            bytes data
        );

    //ApproveTransaction - emited when owner approves transactions
    event ApproveTransaction(address indexed owner, uint indexed txIndex);

    //RevokeApproval - emited when owner changes his mind and doesn't want to approve tx
    event RevokeApproval(address indexed owner, uint indexed txIndex);
    
    //ExecuteTransaction - emited when the ExecuteTransaction is called and last needed approval is provided. Transaction sent and succeed.
    event ExecuteTransaction(address indexed owner, uint indexed txIndex);

    //ExecuteTransaction - emited when the ExecuteTransaction is called and last needed approval is provided. Transaction sent but failed.
    event ExecutionFailed(address indexed owner, uint indexed txIndex);

    address[] public owners; //Holds addresses of owners (addresses able to approve and submit transactions)
    mapping(address => bool) public isOwner; //Keeps track of what address is an owner
    uint public approvalsRequired;   //holds the number of approval's required to execute tx

    //In this
    struct Transaction {
        address to;
        uint value;
        bytes data;
        bool executed;
        uint numApprovals;
    }

    //uint => tx index in array
    //address => tx address
    //bool => is approved?
    mapping(uint => mapping(address => bool)) public isApproved;
    Transaction[] public transactions;

    modifier onlyOwner() {
        require(isOwner[msg.sender], "not owner");
        _;
    }

    modifier txExists(uint _txIndex) {
        require(_txIndex < transactions.length, "tx does not exist");
        _;
    }

    modifier notExecuted(uint _txIndex) {
        require(!transactions[_txIndex].executed, "tx already executed");
        _;
    }

    modifier notApproved(uint _txIndex) {
        require(!isApproved[_txIndex][msg.sender], "tx already confirmed");
        _;
    }


    constructor(address[] memory _owners, uint _approvalsRequired){
        //@notice in this version we don'e assume that msg.sender is an owner
        require(_owners.length > 0, "owners required");

        //@notice this contract doesn't make sense when no approval is needed.
        //@notice number of reqiured approvals can't be highe than owners number.
        require(
            _approvalsRequired > 0 &&
            _approvalsRequired <= _owners.length,
            "invalid number of required confirmations"
        );

        //make owners from given addressess
        for (uint i = 0; i < _owners.length; i++) {
            address owner = _owners[i];

            require(owner != address(0), "invalid owner");

            //secures that one address passed two times will not be included.
            require(!isOwner[owner], "owner not unique");

            isOwner[owner] = true;
            owners.push(owner);
        }

        approvalsRequired = _approvalsRequired;
    }

    //Deposit function, it's only funcitonality is to recieve ether.
    receive() external payable {
        emit Deposit(msg.sender, msg.value);
    }


    //Owner submits the transaction, after that, owners decide to approve or not this tx.
    function submitTransaction(
        address _to,
        uint _value,
        bytes memory _data
    ) public onlyOwner {

        //holds ID of the current transaction submission.
        uint txID = transactions.length;

        //Push current transaction to the "waiting for approval room"
        transactions.push(
            Transaction({
                to: _to,
                value: _value,
                data: _data,
                executed: false,
                numApprovals: 0
            })
        );

        emit SubmitTransaction(msg.sender, txID, _to, _value, _data);
    }

    //@notice:
    //only owner can approve a transaction that exists,
    //wasn't yet executed and which he doesn't approved yet
    function approveTransaction(uint _txID)
        public
        onlyOwner
        txExists(_txID)
        notExecuted(_txID)
        notApproved(_txID)
    {
        Transaction storage transaction = transactions[_txID];
        transaction.numApprovals += 1;
        isApproved[_txID][msg.sender] = true;

        emit ApproveTransaction(msg.sender, _txID);
    }

    //Owner can call this function anytime but it will succeed only when number of approvals is sufficient.
    //@notice we could automate the process in approveTransaction:
    //      if(approvals>=requiredApprovals) executeTransaction();
    //then instead of using requirement her, use only assertion.
    function executeTransaction(uint _txIndex)
        public
        onlyOwner
        txExists(_txIndex)
        notExecuted(_txIndex)
    {

        Transaction storage transaction = transactions[_txIndex];

        require(
            transaction.numApprovals >= approvalsRequired,
            "cannot execute tx"
        );

        transaction.executed = true;

        (bool success, ) = transaction.to.call{value: transaction.value}(
            transaction.data
        );

        if(success == true)   emit ExecuteTransaction(msg.sender, _txIndex);
        else emit ExecutionFailed(msg.sender, _txIndex);
       
    }

    //If owner doesn't want to approve some tx anymore, he uses this function
    //@note of course transaction must exist and can't be yet executed
    function revokeApproval(uint _txID)
        public
        //@notice onlyOwner here does not really make sense since only owner can approve transaction and
        //in requirement in line 196 it checks if msg.sender approved this tx
        onlyOwner
        txExists(_txID)
        notExecuted(_txID)
    {
        Transaction storage transaction = transactions[_txID];

        //Checks if there is really need to revoke transaction
        require(isApproved[_txID][msg.sender], "tx not confirmed");

        transaction.numApprovals -= 1;
        isApproved[_txID][msg.sender] = false;

        emit RevokeApproval(msg.sender, _txID);
    }
}
