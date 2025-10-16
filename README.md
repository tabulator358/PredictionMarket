# Tabmarket - Prediction Market Platform

A decentralized prediction market platform built on Ethereum, featuring TABcoin as the first offchain collateralized CZK token and scalar prediction markets.

## 🚀 Features

- **Scalar Prediction Markets**: Create bets with outcomes between 0-1 (0% to 100%)
- **TABcoin Integration**: First offchain collateralized CZK token system
- **Oracle-based Resolution**: Secure bet resolution by authorized oracles
- **YES/NO Token Trading**: Trade prediction tokens representing market positions
- **Modern UI**: Built with Next.js, Tailwind CSS, and glass morphism design
- **Local Development**: Full local blockchain development environment

## 🏗️ Architecture

### Smart Contracts

- **PredictionMarketERC20**: Main prediction market contract
- **TABcoin**: ERC20 token with authorization-based minting
- **PredictionToken**: Cloneable ERC20 tokens for YES/NO positions

### Frontend

- **Next.js 14**: React framework with App Router
- **Wagmi + RainbowKit**: Ethereum wallet integration
- **TypeScript**: Full type safety
- **Tailwind CSS**: Modern styling with glass morphism

## 📋 Prerequisites

- Node.js 18+ 
- Yarn package manager
- Git

## 🛠️ Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd prediction_market_v0/PredictionMarket
   ```

2. **Install dependencies**
   ```bash
   yarn install
   ```

3. **Set up environment variables**
   
   Create `packages/hardhat/.env`:
   ```env
   ALCHEMY_API_KEY=your_alchemy_key
   ETHERSCAN_V2_API_KEY=your_etherscan_key
   __RUNTIME_DEPLOYER_PRIVATE_KEY=0x_your_private_key
   ```

   Create `packages/nextjs/.env.local` (optional, for custom addresses):
   ```env
   NEXT_PUBLIC_PREDICTION_ADDRESS=0x_market_address
   NEXT_PUBLIC_TAB_ADDRESS=0x_tab_address
   NEXT_PUBLIC_ALCHEMY_API_KEY=your_alchemy_key
   ```

## 🚀 Quick Start

### Local Development

1. **Start local blockchain**
   ```bash
   yarn chain
   ```

2. **Deploy contracts** (in new terminal)
   ```bash
   yarn deploy
   ```

3. **Start frontend** (in new terminal)
   ```bash
   yarn start
   ```

4. **Connect wallet**
   - Open http://localhost:3000
   - Connect MetaMask to Localhost 8545
   - Import the first Hardhat account (private key in terminal output)

### Production Deployment

1. **Deploy to Sepolia**
   ```bash
   cd packages/hardhat
   yarn deploy --network sepolia
   ```

2. **Update frontend environment**
   ```bash
   # Update packages/nextjs/.env.local with deployed addresses
   NEXT_PUBLIC_PREDICTION_ADDRESS=0x_deployed_market_address
   NEXT_PUBLIC_TAB_ADDRESS=0x_deployed_tab_address
   ```

3. **Deploy frontend**
   ```bash
   yarn vercel
   ```

## 📖 Usage Guide

### Creating a Bet

1. Navigate to the main page
2. Enter a description in "Create a bet" section
3. Click "Create Bet"
4. Note the returned Bet ID

### Funding a Bet

1. Enter the Bet ID and amount in "Fund a bet" section
2. Click "Approve" to authorize the market contract
3. Click "Fund" to deposit TAB tokens and receive YES/NO tokens

### Resolving a Bet

1. Only the Oracle address can resolve bets
2. Enter Bet ID and outcome (0.0 to 1.0 or percentage)
3. Click "Resolve" to finalize the bet

### Redeeming Tokens

1. After a bet is resolved, enter Bet ID and token amount
2. Select YES or NO tokens to redeem
3. Click "Approve & Redeem" to exchange tokens for TAB

### TABcoin Management

1. Navigate to `/tab` page
2. **As Authorizer**: Mint tokens or authorize claims
3. **As User**: Claim authorized TAB tokens or burn your tokens

## 🔧 Development

### Project Structure

```
packages/
├── hardhat/           # Smart contracts
│   ├── contracts/     # Solidity contracts
│   ├── deploy/        # Deployment scripts
│   └── test/          # Contract tests
└── nextjs/            # Frontend application
    ├── app/           # Next.js app router pages
    ├── components/    # React components
    ├── hooks/         # Custom hooks
    └── utils/         # Utility functions
```

### Key Commands

```bash
# Development
yarn chain          # Start local blockchain
yarn deploy         # Deploy contracts locally
yarn start          # Start frontend
yarn test           # Run contract tests

# Building
yarn build          # Build frontend
yarn compile        # Compile contracts

# Deployment
yarn deploy --network sepolia    # Deploy to Sepolia
yarn vercel         # Deploy frontend to Vercel
```

### Smart Contract Details

#### PredictionMarketERC20

- **Constructor**: `(IERC20 collateral, address tokenImpl)`
- **Key Functions**:
  - `createBet(string description)` → Creates new bet, returns betId
  - `fundBet(uint256 betId, uint256 amount)` → Fund bet with TAB tokens
  - `resolveBet(uint256 betId, uint256 outcome1e18)` → Resolve bet (Oracle only)
  - `redeem(uint256 betId, bool isYes, uint256 amountTokens)` → Redeem tokens

#### TABcoin

- **Features**: Authorization-based minting system
- **Key Functions**:
  - `mint(address to, uint256 amount)` → Mint tokens (Authorizer only)
  - `claim()` → Claim authorized tokens
  - `authorizeClaim(address user)` → Authorize user to claim (Authorizer only)

## 🔐 Security

- **Oracle Authorization**: Only designated Oracle can resolve bets
- **Authorization System**: TABcoin uses whitelist-based minting
- **Reentrancy Protection**: All state-changing functions protected
- **Input Validation**: Comprehensive parameter validation

## 🌐 Networks

### Supported Networks

- **Localhost**: Development (Chain ID: 31337)
- **Sepolia**: Testnet (Chain ID: 11155111)
- **Mainnet**: Production (Chain ID: 1)

### Network Configuration

Update `packages/nextjs/scaffold.config.ts` to change target network:

```typescript
targetNetworks: [chains.hardhat], // or chains.sepolia, chains.mainnet
```

## 🐛 Troubleshooting

### Common Issues

1. **"Function not found on ABI"**
   - Ensure correct contract addresses in `.env.local`
   - Verify network connection (Localhost 8545 for local dev)

2. **"Only Oracle can resolve"**
   - Connect with Oracle wallet address
   - Check Oracle address in contract vs. connected wallet

3. **"ERC20InsufficientAllowance"**
   - Run "Approve" before "Fund"
   - Ensure sufficient TAB token balance

4. **"Bet not found"**
   - Create bet first using "Create Bet"
   - Use correct Bet ID (usually starts from 0)

### Debug Tools

- **Contract Debug**: Visit `/debug` to interact with contracts directly
- **Block Explorer**: Use local block explorer at `/blockexplorer`
- **Console Logs**: Check browser console for detailed error messages

## 📝 License

MIT License - see LICENSE file for details

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

## 📞 Support

For questions and support:
- Create an issue in the repository
- Check the troubleshooting section
- Review contract documentation in `/debug`

---

**Built with ❤️ using Scaffold-ETH 2**