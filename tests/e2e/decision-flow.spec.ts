import { expect, test } from '@playwright/test';

const successResponse = {
  status: 'success',
  message: '灵隐寺的优点是更经典，缺点是路上更久。\n岳王庙的优点是更顺路，缺点是游览体量较小。\n\n我的建议：请优先选择交通更顺路的目的地。',
  maxInputChars: 12000,
  trafficSummary: {
    source: '高德地图路线数据',
    queriedAtText: '刚刚查询',
    origin: {
      name: '西湖',
      resolvedName: '杭州西湖',
      location: '120.141,30.259',
    },
    candidates: [
      {
        id: 'candidate-0',
        name: '灵隐寺',
        resolvedName: '灵隐寺',
        location: '120.100,30.240',
        routes: [
          {
            mode: 'transit',
            label: '公交/地铁',
            durationMinutes: 25,
            durationText: '约 25 分钟',
            distanceText: '约 5.2 公里',
            lineNamesText: '7路',
            walkingDistanceText: '步行约 680 米',
            transfersText: '换乘 0 次',
            verificationUrl: 'https://uri.amap.com/navigation?mode=bus&callnative=1',
          },
          {
            mode: 'driving',
            label: '驾车/打车',
            durationMinutes: 12,
            durationText: '约 12 分钟',
            distanceText: '约 4.1 公里',
            verificationUrl: 'https://uri.amap.com/navigation?mode=car&callnative=1',
          },
        ],
      },
      {
        id: 'candidate-1',
        name: '岳王庙',
        resolvedName: '岳王庙',
        location: '120.140,30.253',
        routes: [
          {
            mode: 'transit',
            label: '公交/地铁',
            durationMinutes: 15,
            durationText: '约 15 分钟',
            lineNamesText: '27路',
            verificationUrl: 'https://uri.amap.com/navigation?mode=bus&callnative=1',
          },
          {
            mode: 'cycling',
            label: '骑行',
            durationMinutes: 10,
            durationText: '约 10 分钟',
            verificationUrl: 'https://uri.amap.com/navigation?mode=ride&callnative=1',
          },
        ],
      },
    ],
    trafficInsight: {
      type: 'obvious',
      title: '岳王庙明显更方便',
      reasons: ['公交/地铁去岳王庙少 10 分钟', '骑行去岳王庙也更轻松'],
    },
    notice: '交通数据来自高德地图路线数据；AI 只基于这些路线数据比较交通。实际导航以高德为准。',
  },
};

const clarificationResponse = {
  status: 'needs_clarification',
  message: '请确认目的地名称是否有误，并补充当前地点和两个下午候选目的地后再试。',
  maxInputChars: 12000,
};

const dailyResponse = {
  status: 'success',
  message: '自己做饭的优点是省钱、更可控，缺点是更耗精力。点外卖的优点是省心，缺点是更贵。\n\n我的建议：今晚点外卖，早点休息。',
  maxInputChars: 12000,
};

test('submits the editable default example and shows a plain-text reply', async ({ page }, testInfo) => {
  await page.route('**/api/decision', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify(successResponse),
    });
  });

  await page.goto('/');
  await page.getByRole('button', { name: '旅行' }).click();

  const input = page.getByLabel('说说你想去哪里，我帮你做决定。');
  await expect(input).toContainText('目的地 A');
  await input.fill('我已经到了西湖，下午去灵隐寺或岳庙，想比较交通和游客评价。');
  await page.getByRole('button', { name: '帮我做决定' }).click();

  await expect(page.getByRole('heading', { name: '给你的建议' })).toBeVisible();
  await expect(page.getByRole('heading', { name: '交通对比' })).toBeVisible();
  await expect(page.getByText('数据来源：高德地图路线数据 · 刚刚查询')).toBeVisible();
  await expect(page.getByText('步行约 680 米')).toBeVisible();
  await expect(page.getByText('交通判断：岳王庙明显更方便')).toBeVisible();
  await expect(page.getByRole('link', { name: '高德查看' }).first()).toHaveAttribute(
    'href',
    /uri\.amap\.com\/navigation/,
  );
  await expect(page.getByText('交通更顺路', { exact: false })).toBeVisible();
  await expect(page.locator('iframe')).toHaveCount(0);
});

test('defaults to daily decisions and submits to the daily endpoint', async ({ page }) => {
  let dailyRequestCount = 0;
  let travelRequestCount = 0;

  await page.route('**/api/daily-decision', async (route) => {
    dailyRequestCount += 1;
    await new Promise((resolve) => {
      setTimeout(resolve, 300);
    });
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify(dailyResponse),
    });
  });
  await page.route('**/api/decision', async (route) => {
    travelRequestCount += 1;
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify(successResponse),
    });
  });

  await page.goto('/');

  const dailyInput = page.getByLabel('说说你在纠结什么，我帮你做决定。');
  await expect(dailyInput).toContainText('自己做饭还是点外卖');
  await expect(page.getByText('请说明你的选项、当前状态和主要关注点', { exact: false })).toBeVisible();

  await dailyInput.fill('我今晚纠结是自己做饭还是点外卖，想省钱但也不想太累，明天还要早起。');
  await page.getByRole('button', { name: '帮我做决定' }).click();

  await expect(page.getByText('正在整理你的选择，请稍候…')).toBeVisible();
  await expect(page.getByRole('heading', { name: '给你的建议' })).toBeVisible();
  await expect(page.getByText('今晚点外卖', { exact: false })).toBeVisible();
  expect(dailyRequestCount).toBe(1);
  expect(travelRequestCount).toBe(0);
  await expect(page.getByRole('heading', { name: '交通对比' })).not.toBeVisible();
});

test('preserves each category input and latest reply while switching', async ({ page }) => {
  await page.route('**/api/daily-decision', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify(dailyResponse),
    });
  });
  await page.route('**/api/decision', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify(successResponse),
    });
  });

  await page.goto('/');
  await page.getByRole('button', { name: '旅行' }).click();
  const travelInput = page.getByLabel('说说你想去哪里，我帮你做决定。');
  await travelInput.clear();
  await travelInput.fill('旅行输入：我已经到了西湖，下午去灵隐寺或岳庙。');
  await page.getByRole('button', { name: '日常' }).click();
  const dailyInput = page.getByLabel('说说你在纠结什么，我帮你做决定。');
  await dailyInput.clear();
  await dailyInput.fill('日常输入：今晚自己做饭还是点外卖？想省力。');
  await page.getByRole('button', { name: '帮我做决定' }).click();
  await expect(page.getByText('今晚点外卖', { exact: false })).toBeVisible();

  await page.getByRole('button', { name: '旅行' }).click();
  await expect(page.getByLabel('说说你想去哪里，我帮你做决定。')).toHaveValue(
    '旅行输入：我已经到了西湖，下午去灵隐寺或岳庙。',
  );
  await expect(page.getByRole('heading', { name: '给你的建议' })).not.toBeVisible();

  await page.getByRole('button', { name: '日常' }).click();
  await expect(page.getByLabel('说说你在纠结什么，我帮你做决定。')).toHaveValue(
    '日常输入：今晚自己做饭还是点外卖？想省力。',
  );
  await expect(page.getByText('今晚点外卖', { exact: false })).toBeVisible();
});

test('asks the user to confirm locations when information is incomplete', async ({ page }) => {
  await page.route('**/api/decision', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify(clarificationResponse),
    });
  });

  await page.goto('/');
  await page.getByRole('button', { name: '旅行' }).click();
  await page.getByLabel('说说你想去哪里，我帮你做决定。').fill('下午我应该去哪里？');
  await page.getByRole('button', { name: '帮我做决定' }).click();

  await expect(page.getByRole('heading', { name: '请补充地点信息' })).toBeVisible();
  await expect(page.getByText('请确认目的地名称是否有误', { exact: false })).toBeVisible();
});

test('keeps the form locked while a decision is loading', async ({ page }) => {
  await page.route('**/api/decision', async (route) => {
    await new Promise((resolve) => {
      setTimeout(resolve, 500);
    });
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify(successResponse),
    });
  });

  await page.goto('/');
  await page.getByRole('button', { name: '旅行' }).click();
  await page.getByLabel('说说你想去哪里，我帮你做决定。').fill('我已经到了西湖，下午去灵隐寺或岳庙，想比较交通和游客评价。');
  await page.getByRole('button', { name: '帮我做决定' }).click();

  await expect(page.getByRole('button', { name: '正在分析…' })).toBeDisabled();
  await expect(page.getByText('正在查询路线并生成建议，请稍候…')).toBeVisible();
  await expect(page.getByRole('heading', { name: '给你的建议' })).toBeVisible();
});

test('allows retry after a temporary service failure', async ({ page }) => {
  let requestCount = 0;
  await page.route('**/api/decision', async (route) => {
    requestCount += 1;
    if (requestCount === 1) {
      await route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({
          status: 'error',
          message: '暂时无法生成建议，请稍后重试。',
          maxInputChars: 12000,
        }),
      });
      return;
    }

    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify(successResponse),
    });
  });

  await page.goto('/');
  await page.getByRole('button', { name: '旅行' }).click();
  await page.getByLabel('说说你想去哪里，我帮你做决定。').fill('我已经到了西湖，下午去灵隐寺或岳庙，想比较交通和游客评价。');
  await page.getByRole('button', { name: '帮我做决定' }).click();

  await expect(page.getByRole('heading', { name: '暂时无法完成' })).toBeVisible();
  await expect(page.getByText('暂时无法生成建议，请稍后重试。')).toBeVisible();
  await page.getByRole('button', { name: '帮我做决定' }).click();
  await expect(page.getByRole('heading', { name: '给你的建议' })).toBeVisible();
});
