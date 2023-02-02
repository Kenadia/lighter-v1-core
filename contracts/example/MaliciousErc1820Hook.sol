// SPDX-License-Identifier: MIT

pragma solidity 0.8.16;

import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";

interface IERC1820Registry {
    function setInterfaceImplementer(
        address _addr,
        bytes32 _interfaceHash,
        address _implementer
    ) external;
}

contract MaliciousErc1820Hook is Ownable {

    bytes32 constant internal ERC1820_ACCEPT_MAGIC = keccak256(
        abi.encodePacked("ERC1820_ACCEPT_MAGIC")
    );

    bool public _DOS_;

    function setDos(bool dos) external onlyOwner {
        _DOS_ = dos;
    }

    function canImplementInterfaceForAddress(
        bytes32 /* interfaceHash*/,
        address /* addr */
    ) external pure returns(bytes32) {
        return ERC1820_ACCEPT_MAGIC;
    }

    function tokensReceived(
        bytes4 /* functionSig */,
        bytes32 /* partition */,
        address /* operator */,
        address /* from */,
        address /* to */,
        uint256 /* value */,
        bytes calldata /* data */,
        bytes calldata /* operatorData */
    ) external view {
        require(!_DOS_, "Denial of service");
    }
}
