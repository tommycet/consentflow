// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import "forge-std/Test.sol";
contract TestSelector is Test {
    function test_Selector() public pure {
        bytes4 sel = bytes4(keccak256("OwnableUnauthorizedAccount(address)"));
        console.logBytes4(sel);
    }
}
