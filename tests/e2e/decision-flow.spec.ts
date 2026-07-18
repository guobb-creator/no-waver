import { expect, test } from '@playwright/test';

const successResponse = {
  status: 'success',
  message: '演示建议：请优先选择交通更顺路的目的地。',
  maxInputChars: 12000,
};

const clarificationResponse = {
  status: 'needs_clarification',
  message: '请确认目的地名称是否有误，并补充当前地点和两个下午候选目的地后再试。',
  maxInputChars: 12000,
};

test('submits the editable default example and shows a plain-text reply', async ({ page }) => {
  await page.route('**/api/decision', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify(successResponse),
    });
  });

  await page.goto('/');

  const input = page.getByLabel('告诉我你的旅行选择');
  await expect(input).toContainText('目的地 A');
  await input.fill('我已经到了西湖，下午去灵隐寺或岳庙，想比较交通和游客评价。');
  await page.getByRole('button', { name: '帮我做决定' }).click();

  await expect(page.getByRole('heading', { name: '给你的建议' })).toBeVisible();
  await expect(page.getByText('交通更顺路', { exact: false })).toBeVisible();
});

test('asks the user to confirm locations when information is incomplete', async ({ page }) => {
  await page.route('**/api/decision', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify(clarificationResponse),
    });
  });

  await page.goto('/');
  await page.getByLabel('告诉我你的旅行选择').fill('下午我应该去哪里？');
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
  await page.getByLabel('告诉我你的旅行选择').fill('我已经到了西湖，下午去灵隐寺或岳庙，想比较交通和游客评价。');
  await page.getByRole('button', { name: '帮我做决定' }).click();

  await expect(page.getByRole('button', { name: '正在分析…' })).toBeDisabled();
  await expect(page.getByText('正在整理你的选择，请稍候…')).toBeVisible();
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
  await page.getByLabel('告诉我你的旅行选择').fill('我已经到了西湖，下午去灵隐寺或岳庙，想比较交通和游客评价。');
  await page.getByRole('button', { name: '帮我做决定' }).click();

  await expect(page.getByRole('heading', { name: '暂时无法完成' })).toBeVisible();
  await expect(page.getByText('暂时无法生成建议，请稍后重试。')).toBeVisible();
  await page.getByRole('button', { name: '帮我做决定' }).click();
  await expect(page.getByRole('heading', { name: '给你的建议' })).toBeVisible();
});
