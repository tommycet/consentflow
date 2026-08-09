// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../contracts/ConsentRegistry.sol";
import "../contracts/ContributionReceipt.sol";

contract BatchCreateTest is Test {
    ConsentRegistry public registry;
    ContributionReceipt public receipt;

    address participant = address(0x1111);

    bytes32 study = keccak256("study-1");
    bytes32 purpose = keccak256("purpose-1");
    bytes32 v1 = keccak256("v1");

    function setUp() public {
        vm.deal(participant, 1 ether);

        receipt = new ContributionReceipt(address(0));
        registry = new ConsentRegistry(address(receipt));
        receipt.setRegistry(address(registry));
    }

    function test_BatchCreate_3Consents() public {
        vm.prank(participant);

        bytes32[] memory cviHashes = new bytes32[](3);
        bytes32[] memory studyIds = new bytes32[](3);
        bytes32[] memory purposeHashes = new bytes32[](3);
        bytes32[] memory policyVersions = new bytes32[](3);
        uint64[] memory expiresAts = new uint64[](3);
        bytes[] memory receiptDatas = new bytes[](3);

        for (uint256 i = 0; i < 3; i++) {
            cviHashes[i] = keccak256(abi.encodePacked("cvi", i));
            studyIds[i] = keccak256(abi.encodePacked("study", i));
            purposeHashes[i] = keccak256(abi.encodePacked("purpose", i));
            policyVersions[i] = keccak256(abi.encodePacked("v", i));
            expiresAts[i] = uint64(block.timestamp + 1 days);
            receiptDatas[i] = "";
        }

        uint256[] memory consentIds = registry.batchCreateConsent(
            cviHashes,
            studyIds,
            purposeHashes,
            policyVersions,
            expiresAts,
            receiptDatas
        );

        assertEq(consentIds.length, 3);
        assertEq(consentIds[0], 1);
        assertEq(consentIds[1], 2);
        assertEq(consentIds[2], 3);

        // Verify all consents exist and are active
        for (uint256 i = 0; i < 3; i++) {
            IConsentRegistry.Consent memory c = registry.getConsent(consentIds[i]);
            assertEq(uint8(c.status), uint8(IConsentRegistry.ConsentStatus.ACTIVE));
            assertEq(c.participant, participant);
            assertEq(c.cviAttestationHash, cviHashes[i]);
            assertEq(c.studyId, studyIds[i]);
            assertEq(c.purposeHash, purposeHashes[i]);
            assertEq(c.policyVersion, policyVersions[i]);
            assertEq(c.expiresAt, expiresAts[i]);
        }
    }

    function test_BatchCreate_MismatchedArrays_Reverts() public {
        vm.prank(participant);

        bytes32[] memory cviHashes = new bytes32[](2);
        bytes32[] memory studyIds = new bytes32[](2);
        bytes32[] memory purposeHashes = new bytes32[](2);
        bytes32[] memory policyVersions = new bytes32[](2);
        uint64[] memory expiresAts = new uint64[](2);
        bytes[] memory receiptDatas = new bytes[](2);

        for (uint256 i = 0; i < 2; i++) {
            cviHashes[i] = keccak256(abi.encodePacked("cvi", i));
            studyIds[i] = keccak256(abi.encodePacked("study", i));
            purposeHashes[i] = keccak256(abi.encodePacked("purpose", i));
            policyVersions[i] = keccak256(abi.encodePacked("v", i));
            expiresAts[i] = uint64(block.timestamp + 1 days);
            receiptDatas[i] = "";
        }

        // Make receiptDatas length 1 to mismatch
        bytes[] memory mismatchedReceiptDatas = new bytes[](1);
        mismatchedReceiptDatas[0] = "";

        vm.expectRevert(
            abi.encodeWithSelector(
                bytes4(keccak256("ArrayLengthMismatch()")),
                ""
            )
        );
        registry.batchCreateConsent(
            cviHashes,
            studyIds,
            purposeHashes,
            policyVersions,
            expiresAts,
            mismatchedReceiptDatas
        );
    }

    function test_BatchCreate_ExceedsLimit_Reverts() public {
        vm.prank(participant);

        uint256 batchSize = 51;
        bytes32[] memory cviHashes = new bytes32[](batchSize);
        bytes32[] memory studyIds = new bytes32[](batchSize);
        bytes32[] memory purposeHashes = new bytes32[](batchSize);
        bytes32[] memory policyVersions = new bytes32[](batchSize);
        uint64[] memory expiresAts = new uint64[](batchSize);
        bytes[] memory receiptDatas = new bytes[](batchSize);

        for (uint256 i = 0; i < batchSize; i++) {
            cviHashes[i] = keccak256(abi.encodePacked("cvi", i));
            studyIds[i] = keccak256(abi.encodePacked("study", i));
            purposeHashes[i] = keccak256(abi.encodePacked("purpose", i));
            policyVersions[i] = keccak256(abi.encodePacked("v", i));
            expiresAts[i] = uint64(block.timestamp + 1 days);
            receiptDatas[i] = "";
        }

        vm.expectRevert(
            abi.encodeWithSelector(
                bytes4(keccak256("BatchTooLarge()")),
                ""
            )
        );
        registry.batchCreateConsent(
            cviHashes,
            studyIds,
            purposeHashes,
            policyVersions,
            expiresAts,
            receiptDatas
        );
    }

    function test_BatchCreate_PastExpiry_Reverts() public {
        vm.prank(participant);

        bytes32[] memory cviHashes = new bytes32[](2);
        bytes32[] memory studyIds = new bytes32[](2);
        bytes32[] memory purposeHashes = new bytes32[](2);
        bytes32[] memory policyVersions = new bytes32[](2);
        uint64[] memory expiresAts = new uint64[](2);
        bytes[] memory receiptDatas = new bytes[](2);

        for (uint256 i = 0; i < 2; i++) {
            cviHashes[i] = keccak256(abi.encodePacked("cvi", i));
            studyIds[i] = keccak256(abi.encodePacked("study", i));
            purposeHashes[i] = keccak256(abi.encodePacked("purpose", i));
            policyVersions[i] = keccak256(abi.encodePacked("v", i));
            receiptDatas[i] = "";
        }

        // First consent valid, second with past expiry
        expiresAts[0] = uint64(block.timestamp + 1 days);
        expiresAts[1] = uint64(block.timestamp - 1);

        vm.expectRevert(
            abi.encodeWithSelector(
                bytes4(keccak256("InvalidExpiry()")),
                ""
            )
        );
        registry.batchCreateConsent(
            cviHashes,
            studyIds,
            purposeHashes,
            policyVersions,
            expiresAts,
            receiptDatas
        );
    }
}
