import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts } = hre;
  const { deploy, get } = deployments;
  const { deployer } = await getNamedAccounts();

  const tab = await get("TABcoin");

  await deploy("PredictionMarketERC20", {
    from: deployer,
    args: [tab.address], // adjust if your constructor differs
    log: true,
    autoMine: true,
  });
};
export default func;
func.tags = ["PredictionMarket"];
func.dependencies = ["TABcoin"];
