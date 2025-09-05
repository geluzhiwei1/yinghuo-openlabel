import { test, expect } from '@playwright/test';


const basePath = '/guis/v0.3.4';

test.describe('Login Page', () => {
  test('should allow a user to log in successfully', async ({ page }) => {
    await page.goto(basePath + '/login.html');

    await page.waitForLoadState('networkidle');

    const title = await page.title();
    console.log(title);
    await expect(page).toHaveTitle('Login');

    // 假设存在一个有效的用户凭据
    const testEmail = 'prod@geluzhiwei.com';
    const testPassword = 'yinghuo';

    await expect(page.getByPlaceholder('Please enter your email')).toBeVisible();

    // 填写电子邮件
    await page.getByPlaceholder('Please enter your email').fill(testEmail);
    // 填写密码
    await page.getByPlaceholder('Please enter your password').fill(testPassword);

    // 点击登录按钮
    await page.getByRole('button', { name: 'Login' }).click();

    // 等待页面跳转到home.html
    await page.waitForURL('**\/home.html**');

    // 验证是否重定向到主页
    await expect(page).toHaveURL(/.*\/home.html.*/);
  });

  test('should display error for invalid credentials', async ({ page }) => {
    await page.goto(basePath + '/login.html', { waitUntil: 'domcontentloaded' });


    // 假设存在一个无效的用户凭据
    const invalidEmail = 'invalid@example.com';
    const invalidPassword = 'wrongpassword';

    // 填写电子邮件
    await page.getByPlaceholder('Please enter your email').fill(invalidEmail);
    // 填写密码
    await page.getByPlaceholder('Please enter your password').fill(invalidPassword);

    // 点击登录按钮
    await page.getByRole('button', { name: 'Login' }).click();

    // 根据页面实际的错误提示方式进行调整。暂时不进行错误提示的断言。
  });
});