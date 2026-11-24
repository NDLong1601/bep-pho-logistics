async (page) => {
  const failures = [];
  page.on('pageerror', error => failures.push(error.message));
  const initialUrl = new URL(page.url());
  initialUrl.searchParams.set('seed', '2026');
  initialUrl.searchParams.set('qa-reset', String(Date.now()));
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.addInitScript(() => {
    const token = new URL(location.href).searchParams.get('qa-reset');
    if (!token || sessionStorage.getItem('bep_pho_qa_reset') === token) return;
    localStorage.removeItem('bep_pho_quan_2d_v1');
    sessionStorage.setItem('bep_pho_qa_reset', token);
  });
  await page.goto(initialUrl.href);
  await page.clock.install();

  async function expectText(selector, expected) {
    const content = (await page.locator(selector).textContent())?.trim();
    if (content !== expected) throw new Error(`${selector}: expected "${expected}", found "${content}"`);
  }

  async function layout(width, height) {
    await page.setViewportSize({ width, height });
    const issues = await page.evaluate(() => {
      const tables = [...document.querySelectorAll('[data-table]')].map(button => button.getBoundingClientRect());
      const errors = [];
      if (document.documentElement.scrollWidth > window.innerWidth) errors.push('horizontal overflow');
      if (tables.some(rect => rect.height < 44 || rect.width < 44)) errors.push('table below touch target size');
      if (tables.some((rect, i) => tables.slice(i + 1).some(other => (
        rect.left < other.right && rect.right > other.left && rect.top < other.bottom && rect.bottom > other.top
      )))) errors.push('overlapping tables');
      return errors;
    });
    if (issues.length) throw new Error(`${width}×${height}: ${issues.join(', ')}`);
  }

  await expectText('#shift-mode', 'Chưa mở cửa');
  if (await page.locator('#dish-list li').count() !== 3) throw new Error('Menu did not load');
  await page.getByRole('button', { name: 'Mở cửa', exact: true }).click();
  await expectText('#wait-door', '2');
  await page.getByRole('button', { name: /^Bàn 1.*Xếp khách/ }).click();
  await page.getByRole('button', { name: /^Bàn 2.*Xếp khách/ }).click();
  await page.clock.runFor(7300);
  await expectText('#wait-kitchen', '1');
  await expectText('#cash', '180');
  await page.getByRole('button', { name: 'Phục vụ tự nhận việc' }).click();

  await layout(375, 812);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.clock.runFor(11000);
  if (Number(await page.locator('#wait-ready').textContent()) < 1) throw new Error('No cooked dish waiting');
  await page.getByRole('button', { name: /^Bàn 1.*Chờ mang món/ }).click();
  await page.clock.runFor(15000);
  await expectText('#served-label', '1 đơn');
  await expectText('[data-table="1"] .table-stage', 'Chờ dọn bàn');
  const cash = Number(await page.locator('#cash').textContent());
  if (cash <= 180) throw new Error('The paid order did not add cash');

  await page.getByRole('button', { name: /^Bàn 1.*Chờ dọn bàn/ }).click();
  await page.clock.runFor(3900);
  const afterCleaning = await page.locator('[data-table="1"]').getAttribute('data-stage');
  if (afterCleaning !== 'free') throw new Error('The table did not become available');
  await page.getByRole('button', { name: /Nhập \+15 nguyên liệu/ }).click();
  await expectText('#cash', String(cash - 36));
  await page.getByRole('button', { name: 'Phục vụ tự nhận việc' }).click();
  await page.getByLabel('Tự xếp bàn').check();
  await page.getByRole('button', { name: 'Ngừng đón khách' }).click();
  await page.clock.runFor(78000);
  await expectText('#summary-title', 'Tổng kết ca 1');
  const served = await page.locator('#served-label').textContent();

  await page.reload();
  await expectText('#summary-title', 'Tổng kết ca 1');
  await expectText('#served-label', served);
  await page.getByRole('button', { name: 'Mở ca tiếp theo' }).click();
  await expectText('#shift-number', 'Ca 2');
  await expectText('#served-label', '0 đơn');
  await layout(812, 375);

  if (failures.length) throw new Error(failures.join('\n'));
  return { desktop: '1440×900', touch: '375×812 and 812×375', firstShift: served, nextShift: 'Ca 2' };
}
