// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";

/**
 * @title TABcoin
 * @notice ERC20 token s pevně daným authorizerem:
 *  - jediný možný authorizer je 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
 *  - může mintovat (emitovat) libovolnou částku
 *  - může povolit claim v násobcích (každé povolení = 1× CLAIM_AMOUNT) a případně jednotlivé povolení odebrat
 *  - držitelé mohou pálit (burn) své tokeny
 *
 *  ABI je zachováno: nezměnili jsme signatury funkcí, eventy ani public proměnné.
 */
contract TABcoin is ERC20, ERC20Burnable {
    uint8 private constant _DECIMALS = 18;
    uint256 public constant CLAIM_AMOUNT = 1000 * 10 ** _DECIMALS;

    /// @notice Pevně daný authorizer (neměnný)
    address public constant AUTHORIZER = 0x9bc0ccBb80544ff09F8ac14bB07dddb688FdEE2B;

    /// @dev Původní public proměnné kvůli ABI (zůstávají):
    /// claimAuthorized: true pokud má adresa >0 povolení
    mapping(address => bool) public claimAuthorized;
    /// claimConsumed: true pokud už někdy claimovala (informativní, neblokuje další claime)
    mapping(address => bool) public claimConsumed;

    /// @dev Interní čítač počtu povolených claimů pro adresu (nezveřejňovat = nemění ABI)
    mapping(address => uint256) private _claimAllowance;

    event ClaimAuthorized(address indexed user);
    event ClaimRevoked(address indexed user);
    event Claimed(address indexed user, uint256 amount);
    event Minted(address indexed to, uint256 amount);

    constructor() ERC20("TABcoin", "TAB") {}

    modifier onlyAuthorizer() {
        require(msg.sender == AUTHORIZER, "Not authorizer");
        _;
    }

    /// @notice Authorizer přidá JEDNO povolení claimu dané adrese (může volat opakovaně)
    function authorizeClaim(address user) external onlyAuthorizer {
        require(user != address(0), "Zero address");
        unchecked {
            _claimAllowance[user] += 1;
        }
        // držíme synchronizaci s původním veřejným ukazatelem
        claimAuthorized[user] = (_claimAllowance[user] > 0);
        emit ClaimAuthorized(user);
    }

    /// @notice Authorizer odebere JEDNO dříve přidané povolení claimu (pokud nějaké zbývá)
    function revokeClaim(address user) external onlyAuthorizer {
        if (_claimAllowance[user] > 0) {
            _claimAllowance[user] -= 1;
        }
        claimAuthorized[user] = (_claimAllowance[user] > 0);
        emit ClaimRevoked(user);
    }

    /// @notice Uživatel provede claim (pokud má k dispozici alespoň jedno povolení)
    function claim() external {
        uint256 allowanceLeft = _claimAllowance[msg.sender];
        require(allowanceLeft > 0, "Not authorized");

        // odebereme jedno „povolení“ a mintneme CLAIM_AMOUNT
        _claimAllowance[msg.sender] = allowanceLeft - 1;
        claimAuthorized[msg.sender] = (_claimAllowance[msg.sender] > 0);

        // historická informace – někdy claimnul
        if (!claimConsumed[msg.sender]) {
            claimConsumed[msg.sender] = true;
        }

        _mint(msg.sender, CLAIM_AMOUNT);
        emit Claimed(msg.sender, CLAIM_AMOUNT);
    }

    /// @notice Authorizer může mintovat libovolné množství tokenů
    function mint(address to, uint256 amount) external onlyAuthorizer {
        _mint(to, amount);
        emit Minted(to, amount);
    }

    function decimals() public pure override returns (uint8) {
        return _DECIMALS;
    }
}
