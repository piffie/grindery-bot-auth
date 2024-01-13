import { GxOrderStatus } from 'grindery-nexus-common-utils';
import { Database } from '../db/conn';
import { GX_ORDER_COLLECTION, Ordertype } from '../utils/constants';

async function g1OrdersCountByUser(): Promise<void> {
  console.log('\n1. A user ID which would have several successful G1 orders');
  try {
    const db = await Database.getInstance();
    const collectionOrders = db?.collection(GX_ORDER_COLLECTION);

    if (collectionOrders) {
      const successfulG1Orders = await collectionOrders
        .find({ orderType: Ordertype.G1, status: GxOrderStatus.COMPLETE })
        .toArray();

      const userOrderCounts: Record<string, number> = successfulG1Orders.reduce(
        (acc, order) => {
          acc[order.userTelegramID] = (acc[order.userTelegramID] || 0) + 1;
          return acc;
        },
        {},
      );

      for (const [userTelegramID, count] of Object.entries(userOrderCounts)) {
        if (count > 1) {
          console.log(
            `User ${userTelegramID} has multiple successful G1 orders: ${count}`,
          );
        }
      }
    }
    console.log('Analysis completed');
  } catch (error) {
    console.error(`An error occurred during the analysis: ${error.message}`);
  }
}

async function usdOrdersCountByUser(): Promise<void> {
  console.log('\n2. A user ID which would have several successful USD orders');
  try {
    const db = await Database.getInstance();
    const collectionOrders = db?.collection(GX_ORDER_COLLECTION);

    if (collectionOrders) {
      const successfulUSDOrders = await collectionOrders
        .find({ orderType: Ordertype.USD, status: GxOrderStatus.COMPLETE })
        .toArray();

      const userOrderCounts: Record<string, number> =
        successfulUSDOrders.reduce((acc, order) => {
          acc[order.userTelegramID] = (acc[order.userTelegramID] || 0) + 1;
          return acc;
        }, {});

      for (const [userTelegramID, count] of Object.entries(userOrderCounts)) {
        if (count > 1) {
          console.log(
            `User ${userTelegramID} has multiple successful USD orders: ${count}`,
          );
        }
      }
    }

    console.log('Analysis completed');
  } catch (error) {
    console.error(`An error occurred during the analysis: ${error.message}`);
  }
}

async function findZeroUsdInvestmentOrders(): Promise<void> {
  console.log(
    '\n3. A user ID who orders a USD while his invested USD amount is 0',
  );
  try {
    const db = await Database.getInstance();
    const collectionOrders = db?.collection(GX_ORDER_COLLECTION);

    if (collectionOrders) {
      const zeroUsdInvestmentOrders = await collectionOrders
        .find({ orderType: Ordertype.USD, usdFromUsdInvestment: '0.00' })
        .toArray();

      if (zeroUsdInvestmentOrders.length > 0) {
        console.log('Users who ordered USD with zero invested USD amount:');
        zeroUsdInvestmentOrders.forEach((order) => {
          console.log(
            `User ID: ${order.userTelegramID}, Order ID: ${order._id}`,
          );
        });
      }
    }

    console.log('Analysis completed');
  } catch (error) {
    console.error(
      `An error occurred: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
}

async function findUsersWithUsdButNoG1Orders(): Promise<void> {
  console.log(
    '\n4. A user ID who has no G1 order even though he has a USD order',
  );
  try {
    const db = await Database.getInstance();
    const collectionOrders = db?.collection(GX_ORDER_COLLECTION);

    if (collectionOrders) {
      const usdOrders = await collectionOrders
        .find({ orderType: Ordertype.USD })
        .toArray();
      const userIdsWithUsdOrders = new Set(
        usdOrders.map((order) => order.userTelegramID),
      );

      const g1Orders = await collectionOrders
        .find({ orderType: Ordertype.G1 })
        .toArray();
      const userIdsWithG1Orders = new Set(
        g1Orders.map((order) => order.userTelegramID),
      );

      userIdsWithUsdOrders.forEach((userId) => {
        if (!userIdsWithG1Orders.has(userId)) {
          console.log(
            `User ID ${userId} has a USD order but no corresponding G1 order.`,
          );
        }
      });
    }
    console.log('Analysis completed');
  } catch (error) {
    console.error(
      `An error occurred: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
}

async function execute() {
  try {
    console.log('Starting analyses...');

    await g1OrdersCountByUser();
    await usdOrdersCountByUser();
    await findZeroUsdInvestmentOrders();
    await findUsersWithUsdButNoG1Orders();

    console.log('\nAll analyses completed.');
  } catch (error) {
    console.error(
      `An error occurred during the analyses: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  } finally {
    process.exit(0);
  }
}

execute();
