import { test, expect } from '@playwright/test';

const colors = [
    ['background', '--pg-background', '#20252d', '#ffffff'],
    ['color', '--pg-color', '#e5eaf2', '#303946'],
    ['borderColor', '--pg-border-color', '#586575', '#8290a0'],
    ['gridColor', '--pg-grid-color', '#394555', '#d6dde5'],
    ['focusColor', '--pg-focus-color', '#89baff', '#275dc5'],
    ['hoverBackground', '--pg-hover-background', '#303f51', '#eef5fc'],
    ['hoverBorderColor', '--pg-hover-border-color', '#586575', '#b7cbe0'],
    ['selectedBackground', '--pg-selected-background', '#364d6b', '#dcecff'],
    ['selectedBorderColor', '--pg-selected-border-color', '#89baff', '#548ad3'],
    ['selectedHoverBackground', '--pg-selected-hover-background', '#405f83', '#c9e0fc'],
    ['selectedHoverBorderColor', '--pg-selected-hover-border-color', '#a3cbff', '#275dc5'],
    ['headerBackground', '--pg-header-background', '#303946', '#edf1f6'],
    ['headerColor', '--pg-header-color', '#e5eaf2', '#303946'],
    ['descriptionBackground', '--pg-description-background', '#303946', '#f3f5f8'],
    ['descriptionColor', '--pg-description-color', '#e5eaf2', '#303946'],
    ['editorBackground', '--pg-editor-background', '#20252d', '#ffffff'],
    ['editorColor', '--pg-editor-color', '#e5eaf2', '#303946'],
    ['editorBorderColor', '--pg-editor-border', '#586575', '#8290a0'],
    ['editorAccentColor', '--pg-editor-accent-color', '#89baff', '#275dc5']
];

function row(grid, name) {
    return grid.locator('[part~="row"]').filter({ has: grid.page().locator('[part~="property-name"]', { hasText: new RegExp(`^${name}$`) }) });
}

async function load(page) {
    await page.goto('/sample/themed.html');
    await expect(page.locator('#styled .sample-editor input')).toHaveValue('Hello');
    await expect(page.locator('#plain [part~="editor-text"]').first()).toBeVisible();
    await expect(page.locator('#cssExport')).toHaveValue(/\.inspector-theme/);
}

async function setControl(page, id, value) {
    await page.locator(`#${id}`).evaluate((control, value) => {
        control.value = String(value);
        control.dispatchEvent(new Event('input', { bubbles: true }));
    }, value);
}

async function comparison(page) {
    return page.locator('#plain').evaluate(grid => {
        const selectors = ['[part="tree"]', '[part="header"]', '[part="description"]', '[part="description-title"]',
            '[part~="category-row"]', '[part~="row"]', '[part~="editor-text"]', '[part~="editor-checkbox"]', '[part~="expander"]'];
        const properties = ['background-color', 'color', 'border-top-color', 'border-bottom-color', 'font-family', 'font-size',
            'font-weight', 'padding', 'border-radius', 'filter', 'opacity', 'accent-color', 'height'];
        return selectors.map(selector => {
            const style = getComputedStyle(grid.shadowRoot.querySelector(selector));
            return properties.map(property => style.getPropertyValue(property));
        });
    });
}

function rgb(hex) {
    return `rgb(${[1, 3, 5].map(start => parseInt(hex.slice(start, start + 2), 16)).join(', ')})`;
}

const layout = (height, ratio = 0.5, head = true, description = true) =>
    `grid.rowHeight = ${height};\ngrid.nameColumnRatio = ${ratio};\ngrid.showHead = ${head};\ngrid.showDescription = ${description};`;

test.beforeEach(async ({ page }) => {
    page.errors = [];
    page.on('pageerror', error => page.errors.push(error.message));
});

test.afterEach(async ({ page }) => {
    expect(page.errors, 'No module errors or unhandled clipboard/validation failures').toEqual([]);
});

test('initial dark theme, enabled toggles, density and sample objects remain intact', async ({ page }) => {
    await load(page);
    for (const id of ['theme', 'sheets']) await expect(page.locator(`#${id}`)).toBeChecked();
    await expect(page.locator('#preset')).toHaveValue('dark');
    await expect(page.locator('#density')).toHaveValue('28');
    await expect(page.locator('#height')).toHaveText('28px');
    const styled = page.locator('#styled');
    await expect(styled.locator('[part="tree"]')).toHaveCSS('background-color', 'rgb(32, 37, 45)');
    await expect(styled.locator('[part="tree"]')).toHaveCSS('font-size', '14px');
    await expect(styled.locator('[part="header"]')).toHaveCSS('padding', '5px');
    await expect(styled.locator('[part~="row"]').first()).toHaveCSS('height', '28px');
    await expect(styled.locator('[part~="expander"]').first()).toHaveCSS('filter', 'invert(1)');
    await expect(page.locator('#plain [part="tree"]')).toHaveCSS('background-color', 'rgb(255, 255, 255)');
    for (const selector of ['[part="header"]', '[part="description"]', '[part="description-title"]']) {
        // Preserve the pre-builder sample's inherited black text, not a post-load snapshot.
        await expect(page.locator(`#plain ${selector}`)).toHaveCSS('color', 'rgb(0, 0, 0)');
    }
    await expect(page.locator('#plain [part~="row"]').first()).toHaveCSS('height', '22px');
    for (const id of ['styled', 'plain']) {
        expect(await page.locator(`#${id}`).evaluate(grid => grid.selectedObject)).toEqual({ title: 'Hello', count: 3, enabled: true, mode: 'small', extra: 'Notes' });
    }
    expect(await page.locator('#styled').evaluate(grid => grid.typeDefinitions[0].properties.map(property => property.name))).toEqual(['title', 'count', 'enabled', 'mode', 'extra']);
    await expect(page.locator('#densityExport')).toHaveText(layout(28));
});

test('every color updates scoped variables, computed preview and export without affecting comparison', async ({ page }) => {
    await load(page);
    const plain = await comparison(page);
    const values = {};
    for (const [index, [key, token]] of colors.entries()) {
        const value = `#${(0x183040 + index * 0x030509).toString(16)}`;
        values[key] = value;
        await setControl(page, key, value);
        const declaration = key === 'editorBorderColor' ? `1px solid ${value}` : value;
        expect(await page.locator('#styled').evaluate((grid, token) => getComputedStyle(grid).getPropertyValue(token).trim(), token)).toBe(declaration);
        await expect(page.locator('#cssExport')).toHaveValue(new RegExp(`${token}: ${declaration};`));
    }
    const styled = page.locator('#styled');
    for (const [selector, property, key] of [
        ['[part="tree"]', 'background-color', 'background'], ['[part="tree"]', 'color', 'color'],
        ['[part="tree"]', 'border-top-color', 'borderColor'],
        ['[part~="property-name"]', 'border-right-color', 'gridColor'],
        ['[part="header"]', 'background-color', 'headerBackground'], ['[part="header"]', 'color', 'headerColor'],
        ['[part="description"]', 'background-color', 'descriptionBackground'], ['[part="description"]', 'color', 'descriptionColor'],
        ['.sample-editor input', 'background-color', 'editorBackground'], ['.sample-editor input', 'color', 'editorColor'],
        ['.sample-editor input', 'border-top-color', 'editorBorderColor'],
        ['[part~="editor-checkbox"]', 'accent-color', 'editorAccentColor']
    ]) await expect(styled.locator(selector).first()).toHaveCSS(property, rgb(values[key]));
    await row(styled, 'title').locator('[part~="property-name"]').click();
    await expect(styled.locator('[part="description-title"]')).toHaveCSS('color', rgb(values.focusColor));
    await row(styled, 'count').hover();
    await expect(row(styled, 'count')).toHaveCSS('background-color', rgb(values.hoverBackground));
    await expect(row(styled, 'count')).toHaveCSS('border-bottom-color', rgb(values.hoverBorderColor));
    await expect(row(styled, 'title')).toHaveCSS('background-color', rgb(values.selectedBackground));
    await expect(row(styled, 'title')).toHaveCSS('border-top-color', rgb(values.selectedBorderColor));
    await row(styled, 'title').hover();
    // In the existing cell mode an active row uses selection background even on hover.
    await expect(row(styled, 'title')).toHaveCSS('background-color', rgb(values.selectedBackground));
    await expect(row(styled, 'title')).toHaveCSS('border-top-color', rgb(values.selectedHoverBorderColor));
    await row(styled, 'title').evaluate(element => { element.classList.remove('wb-active'); element.classList.add('wb-selected'); });
    await expect(row(styled, 'title')).toHaveCSS('background-color', rgb(values.selectedHoverBackground));
    await styled.locator('.sample-editor input').focus();
    await expect(styled.locator('[part="tree"]')).toHaveCSS('border-top-color', rgb(values.focusColor));
    expect(await comparison(page)).toEqual(plain);
    await expect(page.locator('#preset')).toHaveValue('custom');
});

test('typography, padding, radii and expanders update live; rowHeight changes only for density', async ({ page }) => {
    await load(page);
    const plain = await comparison(page);
    await page.locator('#styled').evaluate(grid => {
        window.heightWrites = [];
        const descriptor = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(grid), 'rowHeight');
        Object.defineProperty(grid, 'rowHeight', {
            get() { return descriptor.get.call(this); },
            set(value) { heightWrites.push(value); descriptor.set.call(this, value); }
        });
    });
    await page.locator('#fontFamily').selectOption('monospace');
    for (const [id, value] of Object.entries({ fontSize: 16, headerPadding: 9, descriptionPadding: 7, editorPadding: 1, treeRadius: 8, editorRadius: 6, expanderOpacity: 0.65 })) {
        await page.locator(`#${id}`).fill(String(value));
    }
    await page.locator('#expanderFilter').selectOption('none');
    expect(await page.evaluate(() => heightWrites)).toEqual([]);
    const styled = page.locator('#styled');
    for (const selector of ['[part="tree"]', '[part="header"]', '[part="description"]', '.sample-editor input', '[part~="editor-number"]']) {
        await expect(styled.locator(selector).first()).toHaveCSS('font-size', '16px');
        await expect(styled.locator(selector).first()).toHaveCSS('font-family', 'monospace');
    }
    await expect(styled.locator('[part="header"]')).toHaveCSS('padding', '9px');
    await expect(styled.locator('[part="description"]')).toHaveCSS('padding', '7px');
    await expect(styled.locator('.sample-editor input')).toHaveCSS('padding', '1px');
    await expect(styled.locator('[part="tree"]')).toHaveCSS('border-radius', '8px');
    await expect(styled.locator('.sample-editor input')).toHaveCSS('border-radius', '6px');
    await expect(styled.locator('[part~="expander"]').first()).toHaveCSS('opacity', '0.65');
    await expect(styled.locator('[part~="expander"]').first()).toHaveCSS('filter', 'none');
    await page.locator('#density').fill('36');
    await setControl(page, 'density', 36);
    await setControl(page, 'background', '#112233');
    expect(await page.evaluate(() => heightWrites)).toEqual([36]);
    await expect(styled.locator('[part~="row"]').first()).toHaveCSS('height', '36px');
    await expect(page.locator('#height')).toHaveText('36px');
    await expect(page.locator('#densityExport')).toHaveText(layout(36));
    expect(await comparison(page)).toEqual(plain);
});

test('custom editor sheet consumes live variables and clearing it preserves editors and property behavior', async ({ page }) => {
    await load(page);
    const styled = page.locator('#styled');
    const title = styled.locator('.sample-editor input');
    await styled.locator('[part~="category-row"] [part~="expander"]').click();
    await expect(row(styled, 'mode').locator('select')).toBeVisible();
    await title.evaluate(input => window.titleEditor = input);
    for (const [key, value] of Object.entries({ editorBackground: '#152637', editorColor: '#ddecfa', editorBorderColor: '#496a8b', editorAccentColor: '#97bade', editorPadding: 2, editorRadius: 7 })) {
        await setControl(page, key, value);
    }
    for (const control of [title, row(styled, 'count').locator('[part~="editor-number"]'), row(styled, 'mode').locator('select')]) {
        await expect(control).toHaveCSS('background-color', 'rgb(21, 38, 55)');
        await expect(control).toHaveCSS('color', 'rgb(221, 236, 250)');
        await expect(control).toHaveCSS('border-radius', '7px');
        await expect(control).toHaveCSS('padding', '2px');
    }
    await expect(title).toHaveCSS('border-top-color', 'rgb(73, 106, 139)');
    await expect(row(styled, 'enabled').locator('input')).toHaveCSS('accent-color', 'rgb(151, 186, 222)');
    await page.locator('#sheets').uncheck();
    expect(await styled.evaluate(grid => grid.additionalStyleSheets.length)).toBe(0);
    await expect(title).toHaveCSS('background-color', 'rgb(21, 38, 55)');
    await page.locator('#sheets').check();
    expect(await title.evaluate(input => input === window.titleEditor)).toBe(true);
    expect(await styled.evaluate(grid => grid.additionalStyleSheets.length)).toBe(1);
    await title.fill('Edited title');
    await styled.locator('[part="header"]').click();
    expect(await styled.evaluate(grid => grid.selectedObject.title)).toBe('Edited title');
    await row(styled, 'count').locator('[part~="editor-number"]').fill('42');
    await styled.locator('[part="header"]').click();
    expect(await styled.evaluate(grid => grid.selectedObject.count)).toBe(42);
    await row(styled, 'count').locator('[part~="nullable-toggle"]').uncheck();
    expect(await styled.evaluate(grid => grid.selectedObject.count)).toBeNull();
    await row(styled, 'mode').locator('select').selectOption('large');
    expect(await styled.evaluate(grid => grid.selectedObject.mode)).toBe('large');
    const extra = row(styled, 'extra');
    await extra.locator('[part~="any-type-selector"]').selectOption('number');
    await expect(extra.locator('[part~="editor-text"]')).toBeHidden();
    await extra.locator('[part~="editor-number"]').fill('17');
    await styled.locator('[part="header"]').click();
    expect(await styled.evaluate(grid => grid.selectedObject.extra)).toBe(17);
    await expect(page.locator('#values')).toContainText('Edited title');
});

test('complete presets and theme reset synchronize every managed control, token and export', async ({ page }) => {
    await load(page);
    const initialControls = await page.locator('[data-key]').evaluateAll(controls => Object.fromEntries(controls.map(control => [control.dataset.key, control.value])));
    const initialCss = await page.locator('#cssExport').inputValue();
    for (const [key] of colors) await setControl(page, key, '#aabbcc');
    for (const [key, value] of Object.entries({ fontSize: 18, headerPadding: 12, descriptionPadding: 0, editorPadding: 2, treeRadius: 0, editorRadius: 12, rowHeight: 40, expanderOpacity: 0.25 })) {
        await setControl(page, key === 'rowHeight' ? 'density' : key, value);
    }
    await page.locator('#fontFamily').selectOption('Georgia, serif');
    await page.locator('#expanderFilter').selectOption('none');
    await page.locator('#preset').selectOption('light');
    const expectedLight = { ...initialControls, ...Object.fromEntries(colors.map(([key, , , light]) => [key, light])), expanderFilter: 'none' };
    expect(await page.locator('[data-key]').evaluateAll(controls => Object.fromEntries(controls.map(control => [control.dataset.key, control.value])))).toEqual(expectedLight);
    for (const [key, token, , light] of colors) {
        const value = key === 'editorBorderColor' ? `1px solid ${light}` : light;
        expect(await page.locator('#styled').evaluate((grid, token) => getComputedStyle(grid).getPropertyValue(token).trim(), token)).toBe(value);
        expect(await page.locator('#cssExport').inputValue()).toContain(`${token}: ${value};`);
    }
    await expect(page.locator('#styled [part~="expander"]').first()).toHaveCSS('filter', 'none');
    await expect(page.locator('#styled [part="tree"]')).toHaveCSS('background-color', 'rgb(255, 255, 255)');
    await expect(page.locator('#densityExport')).toHaveText(layout(28));
    await page.locator('#preset').selectOption('dark');
    expect(await page.locator('#cssExport').inputValue()).toBe(initialCss);
    await page.locator('#preset').selectOption('light');
    await page.locator('#resetTheme').click();
    expect(await page.locator('[data-key]').evaluateAll(controls => Object.fromEntries(controls.map(control => [control.dataset.key, control.value])))).toEqual(initialControls);
    expect(await page.locator('#cssExport').inputValue()).toBe(initialCss);
    await expect(page.locator('#preset')).toHaveValue('dark');
    await expect(page.locator('#styled [part~="expander"]').first()).toHaveCSS('filter', 'invert(1)');
});

test('density-only reset preserves theme settings and full reset does not change independent toggles', async ({ page }) => {
    await load(page);
    await setControl(page, 'background', '#123456');
    await page.locator('#fontFamily').selectOption('Arial, sans-serif');
    await page.locator('#fontSize').fill('15');
    await page.locator('#density').fill('35');
    const css = await page.locator('#cssExport').inputValue();
    await page.locator('#reset').click();
    await expect(page.locator('#density')).toHaveValue('22');
    await expect(page.locator('#height')).toHaveText('22px');
    await expect(page.locator('#densityExport')).toHaveText(layout(22));
    expect(await page.locator('#cssExport').inputValue()).toBe(css);
    await expect(page.locator('#background')).toHaveValue('#123456');
    await expect(page.locator('#fontSize')).toHaveValue('15');
    await page.locator('#theme').uncheck();
    await page.locator('#sheets').uncheck();
    await page.locator('#resetTheme').click();
    await expect(page.locator('#theme')).not.toBeChecked();
    await expect(page.locator('#sheets')).not.toBeChecked();
    await expect(page.locator('#density')).toHaveValue('28');
    await expect(page.locator('#background')).toHaveValue('#20252d');
    await expect(page.locator('#styled [part="tree"]')).toHaveCSS('background-color', 'rgb(255, 255, 255)');
});

test('theme disable removes every token and optional part rule; re-enable restores retained live state', async ({ page }) => {
    await load(page);
    const plain = await comparison(page);
    await setControl(page, 'background', '#162738');
    await setControl(page, 'focusColor', '#99aabb');
    await page.locator('#fontFamily').selectOption('monospace');
    await page.locator('#fontSize').fill('16');
    const css = await page.locator('#cssExport').inputValue();
    await page.locator('#theme').uncheck();
    expect(await page.locator('#themeHost').evaluate(host => host.style.length)).toBe(0);
    expect(await page.locator('#styled').evaluate(grid => {
        const properties = [...document.querySelector('#previewTheme').sheet.cssRules[0].style];
        return properties.every(property => getComputedStyle(grid).getPropertyValue(property).trim() === '');
    })).toBe(true);
    for (const selector of ['[part="tree"]', '[part="header"]', '[part="description"]', '[part="description-title"]', '[part~="category-row"]', '[part~="expander"]']) {
        for (const property of ['background-color', 'color', 'font-family', 'font-size', 'font-weight', 'filter']) {
            const expected = await page.locator(`#plain ${selector}`).first().evaluate((element, property) => getComputedStyle(element).getPropertyValue(property), property);
            await expect(page.locator(`#styled ${selector}`).first()).toHaveCSS(property, expected);
        }
    }
    await expect(page.locator('#styled .sample-editor input')).toHaveCSS('background-color', 'rgb(255, 255, 255)');
    await expect(page.locator('#styled .sample-editor input')).toHaveCSS('color', 'rgb(0, 0, 0)');
    await expect(page.locator('#styled [part~="row"]').first()).toHaveCSS('height', '28px');
    expect(await page.locator('#cssExport').inputValue()).toBe(css);
    await setControl(page, 'editorBackground', '#223344');
    await expect(page.locator('#styled .sample-editor input')).toHaveCSS('background-color', 'rgb(255, 255, 255)');
    await page.locator('#theme').check();
    await expect(page.locator('#styled [part="tree"]')).toHaveCSS('background-color', 'rgb(22, 39, 56)');
    await expect(page.locator('#styled [part="tree"]')).toHaveCSS('font-size', '16px');
    await expect(page.locator('#styled [part="description-title"]')).toHaveCSS('color', 'rgb(153, 170, 187)');
    await expect(page.locator('#styled .sample-editor input')).toHaveCSS('background-color', 'rgb(34, 51, 68)');
    expect(await comparison(page)).toEqual(plain);
});

test('export is reusable CSS with matching optional parts and no row geometry or sample selectors', async ({ page }) => {
    await load(page);
    await page.locator('#fontFamily').selectOption('Georgia, serif');
    await page.locator('#fontSize').fill('17');
    await page.locator('#editorPadding').fill('2');
    await page.locator('#density').fill('38');
    await setControl(page, 'editorBorderColor', '#ab1234');
    const css = await page.locator('#cssExport').inputValue();
    for (const token of ['--pg-font-size', '--pg-header-font-size', '--pg-description-font-size', '--pg-editor-font-size']) expect(css).toContain(`${token}: 17px;`);
    expect(css).toContain('--pg-editor-padding: 2px;');
    expect(css).toContain('--pg-font-family: Georgia, serif;');
    expect(css).toContain('--pg-editor-border: 1px solid #ab1234;');
    expect(css).toContain('.inspector-theme::part(category-row)');
    expect(css).toContain('.inspector-theme *::part(description-title) { color: var(--pg-focus-color); }');
    expect(css).not.toMatch(/--wb-|rowHeight|row-height|(?:^|[;\s])height\s*:|#styled|#themeHost|\.sample-editor|::part\(row\)/);
    await expect(page.locator('#cssExport')).toHaveAttribute('readonly', '');
    await expect(page.locator('#densityExport')).toHaveText(layout(38));
    // Exercise both documented class placements using the exported sheet itself.
    await page.evaluate(css => {
        document.querySelector('#themeHost').classList.remove('themed');
        const style = document.createElement('style');
        style.textContent = css;
        document.head.append(style);
        document.querySelector('#styled').classList.add('inspector-theme');
    }, css);
    await expect(page.locator('#styled [part="tree"]')).toHaveCSS('font-size', '17px');
    await expect(page.locator('#styled .sample-editor input')).toHaveCSS('border-top-color', 'rgb(171, 18, 52)');
    await expect(page.locator('#styled [part="description-title"]')).toHaveCSS('color', 'rgb(137, 186, 255)');
    await page.evaluate(() => {
        document.querySelector('#styled').classList.remove('inspector-theme');
        document.querySelector('#themeHost').classList.add('inspector-theme');
    });
    await expect(page.locator('#styled [part="tree"]')).toHaveCSS('font-size', '17px');
    await expect(page.locator('#styled [part="description-title"]')).toHaveCSS('color', 'rgb(137, 186, 255)');
    await expect(page.locator('#plain [part="tree"]')).toHaveCSS('font-size', '14px');
});

test('exported optional parts reach forwarded nested wrappers under a themed ancestor', async ({ page }) => {
    await load(page);
    const css = await page.locator('#cssExport').inputValue();
    await page.evaluate(css => {
        const style = document.createElement('style');
        style.textContent = css;
        document.head.append(style);
        const ancestor = document.createElement('section');
        ancestor.className = 'inspector-theme';
        const outer = document.createElement('theme-wrapper');
        outer.attachShadow({ mode: 'open' });
        const inner = document.createElement('theme-inner-wrapper');
        inner.setAttribute('exportparts', 'category-row,description-title');
        inner.attachShadow({ mode: 'open' });
        const grid = document.createElement('node-projects-property-grid');
        grid.id = 'wrapped';
        grid.setAttribute('exportparts', 'category-row,description-title');
        grid.style.height = '350px';
        grid.style.width = '420px';
        grid.showHead = true;
        grid.typeName = 'Example';
        grid.typeDefinitions = document.querySelector('#styled').typeDefinitions;
        grid.selectedObject = { title: 'Wrapped', count: 3, enabled: true, mode: 'small', extra: 'Notes' };
        inner.shadowRoot.append(grid);
        outer.shadowRoot.append(inner);
        ancestor.append(outer);
        document.body.append(ancestor);
    }, css);
    const grid = page.locator('#wrapped');
    await expect(grid.locator('[part="tree"]')).toHaveCSS('background-color', 'rgb(32, 37, 45)');
    await expect(grid.locator('[part~="category-row"]')).toHaveCSS('font-weight', '700');
    await row(grid, 'title').locator('[part~="property-name"]').click();
    await expect(grid.locator('[part="description-title"]')).toHaveCSS('color', 'rgb(137, 186, 255)');
    await expect(page.locator('#plain [part="description-title"]')).toHaveCSS('color', 'rgb(0, 0, 0)');
});

for (const outcome of ['success', 'rejection', 'unavailable']) {
    test(`Copy CSS handles mocked clipboard ${outcome} honestly`, async ({ page }) => {
        await page.addInitScript(outcome => {
            window.copiedCss = [];
            Object.defineProperty(navigator, 'clipboard', { configurable: true, value: outcome === 'unavailable' ? undefined : {
                async writeText(text) {
                    copiedCss.push(text);
                    if (outcome === 'rejection') throw new DOMException('Denied', 'NotAllowedError');
                }
            } });
        }, outcome);
        await load(page);
        await setControl(page, 'background', '#102938');
        await page.locator('#density').fill('32');
        const css = await page.locator('#cssExport').inputValue();
        await page.locator('#copyCss').click();
        if (outcome === 'success') {
            await expect(page.locator('#copyStatus')).toContainText('CSS copied to clipboard');
            expect(await page.evaluate(() => copiedCss)).toEqual([css]);
            expect(css).not.toContain('grid.rowHeight');
            await setControl(page, 'color', '#ccddee');
            await expect(page.locator('#copyStatus')).toContainText('CSS updated');
        } else {
            await expect(page.locator('#copyStatus')).toContainText('Could not copy CSS');
            await expect(page.locator('#copyStatus')).toContainText('copy manually');
            await expect(page.locator('#cssExport')).toBeFocused();
            expect(await page.locator('#cssExport').evaluate(textarea => [textarea.selectionStart, textarea.selectionEnd])).toEqual([0, css.length]);
            expect(await page.evaluate(() => copiedCss)).toEqual(outcome === 'unavailable' ? [] : [css]);
            expect(await page.locator('#cssExport').inputValue()).toBe(css);
        }
    });
}

test('delayed clipboard rejection does not steal editor focus or commit pending input', async ({ page }) => {
    await page.addInitScript(() => {
        Object.defineProperty(navigator, 'clipboard', { configurable: true, value: {
            writeText() { return new Promise((resolve, reject) => { window.rejectCopy = reject; }); }
        } });
    });
    await load(page);
    await page.locator('#copyCss').click();
    await expect(page.locator('#copyCss')).toHaveAttribute('aria-busy', 'true');
    const title = page.locator('#styled .sample-editor input');
    await title.fill('Still editing');
    await title.evaluate(input => input.setSelectionRange(2, 7));
    await page.evaluate(() => rejectCopy(new DOMException('Denied', 'NotAllowedError')));
    await expect(page.locator('#copyStatus')).toContainText('Could not copy CSS');
    await expect(title).toBeFocused();
    await expect(title).toHaveValue('Still editing');
    expect(await title.evaluate(input => [input.selectionStart, input.selectionEnd])).toEqual([2, 7]);
    expect(await page.locator('#styled').evaluate(grid => grid.selectedObject.title)).toBe('Hello');
    await expect(page.locator('#copyCss')).not.toHaveAttribute('aria-busy');
});

test('copy requests are serialized and stale completions cannot claim a newer export was copied', async ({ page }) => {
    await page.addInitScript(() => {
        window.pendingCopies = [];
        window.clipboardValue = '';
        Object.defineProperty(navigator, 'clipboard', { configurable: true, value: {
            writeText(text) {
                return new Promise(resolve => pendingCopies.push({ text, resolve })).then(() => { clipboardValue = text; });
            }
        } });
    });
    await load(page);
    const firstCss = await page.locator('#cssExport').inputValue();
    await page.locator('#copyCss').click();
    await expect(page.locator('#copyCss')).toHaveAttribute('aria-disabled', 'true');
    await setControl(page, 'background', '#123456');
    const nextCss = await page.locator('#cssExport').inputValue();
    await page.locator('#copyCss').evaluate(button => button.click());
    expect(await page.evaluate(() => pendingCopies.length)).toBe(1);
    await page.evaluate(() => pendingCopies[0].resolve());
    await expect(page.locator('#copyCss')).not.toHaveAttribute('aria-disabled');
    await expect(page.locator('#copyStatus')).toContainText('CSS updated');
    expect(await page.evaluate(() => clipboardValue)).toBe(firstCss);
    await page.locator('#copyCss').click();
    expect(await page.evaluate(() => pendingCopies.length)).toBe(2);
    expect(await page.evaluate(() => pendingCopies[1].text)).toBe(nextCss);
    await page.evaluate(() => pendingCopies[1].resolve());
    await expect(page.locator('#copyStatus')).toContainText('CSS copied to clipboard');
    expect(await page.evaluate(() => clipboardValue)).toBe(nextCss);
    await expect(page.locator('#copyCss')).not.toHaveAttribute('aria-disabled');
});

test('invalid and intermediate numeric drafts retain canonical CSS without rewriting input or stealing focus', async ({ page }) => {
    await load(page);
    await page.locator('#fontSize').fill('16');
    const input = page.locator('#fontSize');
    const css = await page.locator('#cssExport').inputValue();
    await input.fill('');
    await expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(await page.locator('#cssExport').inputValue()).toBe(css);
    await setControl(page, 'background', '#234567');
    await expect(input).toHaveValue('');
    await expect(input).toBeFocused();
    await expect(page.locator('#styled [part="tree"]')).toHaveCSS('font-size', '16px');
    // Chromium keeps incomplete native number entries as badInput with an empty DOM value.
    await input.pressSequentially('-');
    expect(await input.evaluate(control => control.validity.badInput)).toBe(true);
    await setControl(page, 'editorRadius', 5);
    expect(await input.evaluate(control => control.validity.badInput)).toBe(true);
    await expect(input).toBeFocused();
    for (const value of ['1', '99', '16.5', '-5', '1e99']) {
        await input.fill(value);
        await expect(input).toHaveAttribute('aria-invalid', 'true');
        await expect(page.locator('#styled [part="tree"]')).toHaveCSS('font-size', '16px');
        expect(await page.locator('#cssExport').inputValue()).toContain('--pg-font-size: 16px;');
        await expect(input).toHaveValue(value);
    }
    await input.fill('');
    await input.pressSequentially('1');
    await expect(input).toHaveValue('1');
    await expect(page.locator('#styled [part="tree"]')).toHaveCSS('font-size', '16px');
    await input.pressSequentially('7');
    await expect(input).toHaveValue('17');
    await expect(input).not.toHaveAttribute('aria-invalid');
    await expect(page.locator('#styled [part="tree"]')).toHaveCSS('font-size', '17px');
    for (const id of ['headerPadding', 'descriptionPadding', 'editorPadding', 'treeRadius', 'editorRadius', 'expanderOpacity']) {
        const control = page.locator(`#${id}`);
        const before = await page.locator('#cssExport').inputValue();
        await control.fill('');
        expect(await page.locator('#cssExport').inputValue()).toBe(before);
        await control.fill('999');
        expect(await page.locator('#cssExport').inputValue()).toBe(before);
        await expect(control).toHaveValue('999');
        await expect(control).toHaveAttribute('aria-invalid', 'true');
    }
    await page.locator('#resetTheme').click();
    await expect(page.locator('[aria-invalid="true"]')).toHaveCount(0);
    await expect(input).toHaveValue('14');
    await page.locator('#fontSize').fill('18');
    await page.locator('#editorPadding').fill('2');
    await page.locator('#reset').click();
    await expect(page.locator('#fitHelp')).toContainText('Fit warning');
});

test('theme, sheet, presets and density preserve grid, selected objects, editors and pending selection', async ({ page }) => {
    await load(page);
    await page.evaluate(() => {
        const grid = document.querySelector('#styled');
        const editor = grid.shadowRoot.querySelector('.sample-editor input');
        window.retained = { grid, object: grid.selectedObject, plainObject: document.querySelector('#plain').selectedObject,
            editor, editors: [...grid.shadowRoot.querySelectorAll('[part~="editor"]')] };
        editor.value = 'Pending title';
        editor.focus();
        editor.setSelectionRange(2, 7);
    });
    for (const [key, value] of Object.entries({ background: '#123456', fontSize: 16, editorPadding: 1, density: 34 })) await setControl(page, key, value);
    await page.evaluate(() => {
        for (const id of ['theme', 'sheets']) {
            const control = document.querySelector(`#${id}`);
            control.checked = false;
            control.dispatchEvent(new Event('change'));
            control.checked = true;
            control.dispatchEvent(new Event('change'));
        }
        const preset = document.querySelector('#preset');
        preset.value = 'light';
        preset.dispatchEvent(new Event('change'));
        document.querySelector('#reset').click();
        document.querySelector('#resetTheme').click();
    });
    expect(await page.evaluate(() => {
        const { grid, object, editor, editors, plainObject } = retained;
        const current = [...grid.shadowRoot.querySelectorAll('[part~="editor"]')];
        return { grid: grid === document.querySelector('#styled'), object: object === grid.selectedObject,
            plain: plainObject === document.querySelector('#plain').selectedObject,
            editors: current.length === editors.length && current.every((node, index) => node === editors[index]),
            focus: grid.shadowRoot.activeElement === editor, value: editor.value,
            selection: [editor.selectionStart, editor.selectionEnd], committed: grid.selectedObject.title };
    })).toEqual({ grid: true, object: true, plain: true, editors: true, focus: true, value: 'Pending title', selection: [2, 7], committed: 'Hello' });
    await page.locator('#styled [part="header"]').click();
    expect(await page.locator('#styled').evaluate(grid => grid.selectedObject.title)).toBe('Pending title');
});

test('narrow view stacks previews without page overflow and all native controls have explicit labels', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 900 });
    await load(page);
    expect(await page.locator('.builder input, .builder select, #cssExport').evaluateAll(controls => controls.every(control => {
        return control.labels.length > 0 && [...control.labels].some(label => label.htmlFor === control.id && label.textContent.trim());
    }))).toBe(true);
    for (const width of [320, 375, 768, 1280]) {
        await page.setViewportSize({ width, height: 900 });
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    }
    await page.setViewportSize({ width: 320, height: 900 });
    const styled = await page.locator('#themeHost').boundingBox();
    const plain = await page.locator('main section').nth(1).boundingBox();
    expect(plain.y).toBeGreaterThanOrEqual(styled.y + styled.height);
    await page.locator('#fontSize').focus();
    await page.locator('#fontSize').press('ArrowUp');
    await expect(page.locator('#fontSize')).toHaveValue('15');
    await expect(page.locator('#styled [part="tree"]')).toHaveCSS('font-size', '15px');
});

test('custom title editor fits its value cell at all supported fonts and responsive widths', async ({ page }) => {
    await load(page);
    await page.locator('#fontSize').fill('18');
    await page.locator('#editorPadding').fill('2');
    await page.locator('#density').fill('40');
    const title = page.locator('#styled .sample-editor input');
    for (const width of [320, 375, 768, 1280]) {
        await page.setViewportSize({ width, height: 900 });
        for (const family of ['system-ui', 'Arial, sans-serif', 'monospace', 'Georgia, serif']) {
            await page.locator('#fontFamily').selectOption(family);
            for (const sheet of [false, true]) {
                await page.locator('#sheets').setChecked(sheet);
                await title.focus();
                const bounds = await title.evaluate(input => {
                    const editor = input.getBoundingClientRect();
                    const cell = input.closest('[part~="property-value"]').getBoundingClientRect();
                    return { left: editor.left - cell.left, right: cell.right - editor.right, width: editor.width };
                });
                expect(bounds.left, `${width}px ${family} sheet=${sheet} left`).toBeGreaterThanOrEqual(-1);
                expect(bounds.right, `${width}px ${family} sheet=${sheet} right`).toBeGreaterThanOrEqual(-1);
                expect(bounds.width).toBeGreaterThan(0);
            }
        }
    }
});

const managedControls = page => page.locator('[data-key]').evaluateAll(controls => Object.fromEntries(controls.map(c => [c.dataset.key, c.type === 'checkbox' ? c.checked : c.value])));

test('connection presets are complete, round-trip all managed state and isolate the comparison', async ({ page }) => {
    await load(page);
    const dark = await managedControls(page);
    const plain = await comparison(page);
    const snapshots = {};
    for (const [preset, height, ratio, base, category] of [
        ['compactConnection', 22, 0.45, '#ffffff', '#eeeeef'], ['connectionForm', 48, 0.4, '#f1f2f4', '#e8eaee']
    ]) {
        await page.locator('#preset').selectOption(preset);
        snapshots[preset] = { controls: await managedControls(page), css: await page.locator('#cssExport').inputValue() };
        await expect(page.locator('#densityExport')).toHaveText(layout(height, ratio, true, false));
        await expect(page.locator('#editorHeightEnabled')).toBeChecked();
        await expect(page.locator('#showDescription')).not.toBeChecked();
        await expect(row(page.locator('#styled'), 'title')).toHaveCSS('background-color', rgb(base));
        await expect(page.locator('#styled [part~="category-row"]')).toHaveCSS('background-color', rgb(category));
        await expect(page.locator('#styled .sample-editor input')).toHaveCSS('height', preset === 'connectionForm' ? '30px' : '20px');
        await expect(page.locator('#fitHelp')).not.toContainText('Fit warning');
        expect(await comparison(page)).toEqual(plain);
        // Every state field is edited, then restored by selecting the complete preset.
        await page.locator('[data-key]').evaluateAll(controls => {
            for (const c of controls) {
                if (c.type === 'checkbox') c.checked = !c.checked;
                else if (c.tagName === 'SELECT') c.selectedIndex = (c.selectedIndex + 1) % c.options.length;
                else if (c.type === 'number' || c.type === 'range') c.value = c.value === c.min ? c.max : c.min;
                else c.value = '#abcdef';
                c.dispatchEvent(new Event('input'));
            }
        });
        await page.locator('#preset').selectOption(preset);
        expect(await managedControls(page)).toEqual(snapshots[preset].controls);
        expect(await page.locator('#cssExport').inputValue()).toBe(snapshots[preset].css);
    }
    for (const preset of ['compactConnection', 'connectionForm']) {
        await page.locator('#preset').selectOption(preset);
        expect(await managedControls(page)).toEqual(snapshots[preset].controls);
    }
    await page.locator('#preset').selectOption('dark');
    expect(await managedControls(page)).toEqual(dark);
    await expect(page.locator('#editorHeightEnabled')).not.toBeChecked();
    expect(await page.locator('#cssExport').inputValue()).not.toContain('--pg-editor-height:');
});

test('new region, category and editor controls update presentation and linked fonts without replacing active editors', async ({ page }) => {
    await load(page);
    const grid = page.locator('#styled');
    await grid.locator('.sample-editor input').evaluate(e => { window.active = e; e.focus(); e.value = 'Pending'; e.setSelectionRange(1, 4); });
    for (const [id, value] of Object.entries({ nameColumnRatio: 65, cellPaddingX: 7, categoryNameInset: 9, expanderSize: 16,
        editorHeight: 30, editorBorderWidth: 2, editorFocusBorderWidth: 2, editorFocusWidth: 1, density: 48,
        descriptionMinHeight: 48, descriptionMaxHeight: 96 })) await setControl(page, id, value);
    await page.evaluate(() => {
        for (const id of ['editorHeightEnabled', 'headerBorderVisible', 'descriptionBorderVisible', 'descriptionMinHeightEnabled', 'descriptionMaxHeightEnabled']) {
            const c = document.getElementById(id); c.checked = true; c.dispatchEvent(new Event('input'));
        }
        for (const id of ['showHead', 'showDescription']) { const c = document.getElementById(id); c.checked = false; c.dispatchEvent(new Event('input')); }
        for (const [id, value] of [['headerFontSize', '18'], ['descriptionFontSize', '12'], ['headerFontWeight', '600'], ['descriptionFontWeight', '500'],
            ['categoryFontWeight', '400'], ['editorBorderStyle', 'dotted'], ['editorFocusBorderStyle', 'solid'], ['editorFocusStyle', 'dashed'], ['expanderPosition', 'center']]) {
            const c = document.getElementById(id); c.value = value; c.dispatchEvent(new Event('input'));
        }
    });
    await expect(grid.locator('[part="header"]')).toBeHidden();
    await expect(grid.locator('[part="description"]')).toBeHidden();
    await expect(grid.locator('[part="header"]')).toHaveCSS('font-size', '18px');
    await expect(grid.locator('[part="description"]')).toHaveCSS('font-size', '12px');
    await expect(grid.locator('[part="description"]')).toHaveCSS('min-height', '48px');
    await expect(grid.locator('[part="description"]')).toHaveCSS('max-height', '96px');
    await expect(grid.locator('[part~="category-row"] [part~="property-name"]')).toHaveCSS('padding-left', '16px');
    await expect(grid.locator('.sample-editor input')).toHaveCSS('height', '30px');
    await expect(grid.locator('.sample-editor input')).toHaveCSS('border-top-style', 'solid');
    await expect(grid.locator('.sample-editor input')).toHaveCSS('outline-style', 'dashed');
    expect(await grid.evaluate(g => ({ same: g.shadowRoot.activeElement === active, value: active.value,
        selection: [active.selectionStart, active.selectionEnd], committed: g.selectedObject.title }))).toEqual({ same: true, value: 'Pending', selection: [1, 4], committed: 'Hello' });
    await setControl(page, 'fontSize', 16);
    for (const selector of ['[part="tree"]', '[part="header"]', '[part="description"]', '.sample-editor input']) {
        await expect(grid.locator(selector)).toHaveCSS('font-size', '16px');
    }
    await expect(page.locator('#headerFontSize')).toHaveValue('inherit');
    await expect(page.locator('#descriptionFontSize')).toHaveValue('inherit');
});

test('new bounded numeric and hex drafts do not overwrite accepted state across unrelated edits', async ({ page }) => {
    await load(page);
    for (const id of ['nameColumnRatio', 'cellPaddingX', 'categoryNameInset', 'editorHeight', 'editorBorderWidth', 'editorFocusWidth',
        'editorFocusBorderWidth', 'descriptionMinHeight', 'descriptionMaxHeight', 'expanderSize']) {
        const before = await page.locator('#cssExport').inputValue();
        const js = await page.locator('#densityExport').textContent();
        await page.locator(`#${id}`).fill('999');
        await expect(page.locator(`#${id}`)).toHaveAttribute('aria-invalid', 'true');
        expect(await page.locator('#cssExport').inputValue()).toBe(before);
        expect(await page.locator('#densityExport').textContent()).toBe(js);
        await setControl(page, 'background', '#123456');
        await expect(page.locator(`#${id}`)).toHaveValue('999');
    }
    await setControl(page, 'rowBackground', '#f1f2f4');
    const css = await page.locator('#cssExport').inputValue();
    await page.locator('#rowBackground').fill('nope');
    await expect(page.locator('#rowBackground')).toHaveAttribute('aria-invalid', 'true');
    expect(await page.locator('#cssExport').inputValue()).toBe(css);
    await page.locator('#preset').selectOption('connectionForm');
    await expect(page.locator('[aria-invalid="true"]')).toHaveCount(0);
});

test('connection appearance export and separate layout recreate a fresh grid; theme-off keeps layout only', async ({ page }) => {
    await load(page);
    const plain = await comparison(page);
    await page.locator('#preset').selectOption('connectionForm');
    const css = await page.locator('#cssExport').inputValue();
    const js = await page.locator('#densityExport').textContent();
    expect(css).toContain('--pg-editor-height: 30px;');
    expect(css).toContain('--pg-editor-border: 1px solid #c6cad0;');
    expect(css).toContain('--pg-header-border: 1px solid #d9dce1;');
    expect(css).toContain('--pg-cell-separator-style: none;');
    expect(css).not.toMatch(/--wb-|rowHeight|row-height|nameColumnRatio|showHead|showDescription|#styled|#themeHost/);
    await page.evaluate(({ css, js }) => {
        const sheet = document.createElement('style'); sheet.textContent = css; document.head.append(sheet);
        const grid = document.createElement('node-projects-property-grid'); grid.id = 'fresh'; grid.className = 'inspector-theme';
        grid.style.height = '350px'; grid.style.width = '440px';
        grid.typeName = 'Example'; grid.typeDefinitions = document.querySelector('#styled').typeDefinitions;
        grid.selectedObject = { title: 'Fresh', count: 3, enabled: true, mode: 'small', extra: 'Notes' };
        document.body.append(grid);
        window.freshLayout = () => Function('grid', js)(grid);
    }, { css, js });
    const fresh = page.locator('#fresh');
    await expect(fresh.locator('[part~="editor-text"]').first()).toBeVisible();
    expect(await fresh.evaluate(g => [g.rowHeight, g.nameColumnRatio, g.showHead, g.showDescription])).toEqual([22, 0.5, false, true]);
    await page.evaluate(() => freshLayout());
    expect(await fresh.evaluate(g => [g.rowHeight, g.nameColumnRatio, g.showHead, g.showDescription])).toEqual([48, 0.4, true, false]);
    await expect(row(fresh, 'title')).toHaveCSS('background-color', 'rgb(241, 242, 244)');
    await expect(fresh.locator('[part~="editor-text"]').first()).toHaveCSS('height', '30px');
    await expect(fresh.locator('[part="description"]')).toBeHidden();
    await page.locator('#theme').uncheck();
    await expect(page.locator('#styled [part="tree"]')).toHaveCSS('background-color', 'rgb(255, 255, 255)');
    expect(await page.locator('#styled').evaluate(g => [g.rowHeight, g.nameColumnRatio, g.showHead, g.showDescription])).toEqual([48, 0.4, true, false]);
    expect(await page.locator('#styled').evaluate(g => [...document.querySelector('#previewTheme').sheet.cssRules[0].style].every(p => getComputedStyle(g).getPropertyValue(p).trim() === ''))).toBe(true);
    expect(await page.locator('#cssExport').inputValue()).toBe(css);
    expect(await comparison(page)).toEqual(plain);
    await page.locator('#theme').check();
    await expect(row(page.locator('#styled'), 'title')).toHaveCSS('background-color', 'rgb(241, 242, 244)');
});

test('compact and form presets fit visible custom, nullable, enum and any controls at wide and narrow widths', async ({ page }) => {
    await load(page);
    const grid = page.locator('#styled');
    await grid.locator('[part~="category-row"] [part~="expander"]').click();
    for (const width of [1280, 768, 320]) {
        await page.setViewportSize({ width, height: 900 });
        for (const preset of ['compactConnection', 'connectionForm']) {
            await page.locator('#preset').selectOption(preset);
            for (const sheets of [false, true]) {
                await page.locator('#sheets').setChecked(sheets);
                expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
                const bounds = await grid.evaluate(g => [...g.shadowRoot.querySelectorAll('input,select')].filter(e => e.getBoundingClientRect().height).map(e => {
                    const a = e.getBoundingClientRect(), b = e.closest('.wb-col').getBoundingClientRect();
                    return { type: e.type, h: a.height, w: a.width, top: a.top - b.top, bottom: b.bottom - a.bottom, left: a.left - b.left, right: b.right - a.right };
                }));
                for (const b of bounds) {
                    expect(b.w, `${width} ${preset} ${b.type}`).toBeGreaterThan(0);
                    expect(b.top).toBeGreaterThanOrEqual(-1);
                    expect(b.bottom).toBeGreaterThanOrEqual(-1);
                    expect(b.left).toBeGreaterThanOrEqual(-1);
                    expect(b.right).toBeGreaterThanOrEqual(-1);
                    if (b.type === 'checkbox') expect(b.h).toBeLessThanOrEqual(20);
                    else expect(b.h).toBe(preset === 'connectionForm' ? 30 : 20);
                }
            }
        }
    }
});

test('custom editor outlines are focus-visible only and nested focus borders consume explicit tokens', async ({ page }) => {
    await load(page);
    const grid = page.locator('#styled'), input = grid.locator('.sample-editor input');
    await setControl(page, 'editorFocusWidth', 2);
    await page.locator('#editorFocusStyle').selectOption('dotted');
    await setControl(page, 'editorFocusBorderWidth', 2);
    await page.locator('#editorFocusBorderStyle').selectOption('solid');
    await setControl(page, 'editorFocusBorderColor', '#123456');
    await expect(input).toHaveCSS('outline-style', 'none');
    await expect(input).toHaveCSS('border-top', '1px solid rgb(88, 101, 117)');
    await input.focus();
    await expect(input).toHaveCSS('outline-style', 'dotted');
    await expect(input).toHaveCSS('outline-width', '2px');
    await expect(input).toHaveCSS('border-top', '2px solid rgb(18, 52, 86)');
    await input.evaluate(e => e.blur());
    await expect(input).toHaveCSS('outline-style', 'none');
    await expect(input).toHaveCSS('border-top', '1px solid rgb(88, 101, 117)');
    await page.locator('#theme').uncheck();
    const originalBorder = await input.evaluate(e => getComputedStyle(e).borderTop);
    await input.focus();
    await expect(input).toHaveCSS('border-top', originalBorder);
    await expect(input).not.toHaveCSS('outline-style', 'dotted');
});

test('showing a tall builder description preserves bottom-row focus and pending edits in a long preview', async ({ page }) => {
    await load(page);
    const grid = page.locator('#styled');
    await grid.evaluate(async g => {
        g.typeDefinitions = [{ name: 'Example', properties: Array.from({ length: 150 }, (_, i) => ({ name: `field${i}`, type: 'string' })) }];
        g.selectedObject = Object.fromEntries(Array.from({ length: 150 }, (_, i) => [`field${i}`, `Value ${i}`]));
        await g.refresh();
    });
    await expect(row(grid, 'field0').locator('input')).toBeVisible();
    await page.locator('#showDescription').uncheck();
    await setControl(page, 'descriptionMinHeight', 240);
    await setControl(page, 'descriptionMaxHeight', 240);
    await page.locator('#descriptionMinHeightEnabled').check();
    await page.locator('#descriptionMaxHeightEnabled').check();
    await grid.locator('[part="tree"]').evaluate(e => e.scrollTop = 1400);
    await expect(row(grid, 'field58').locator('input')).toBeVisible();
    await grid.evaluate(g => {
        const table = g.shadowRoot.querySelector('#table'), bounds = table.getBoundingClientRect();
        const e = [...table.querySelectorAll('input')].filter(e => e.getBoundingClientRect().bottom < bounds.bottom - 3).at(-1);
        window.builderBottom = { e, key: e.closest('.wb-row').querySelector('.wb-title').textContent, top: table.scrollTop };
        e.focus(); e.value = 'Pending builder'; e.setSelectionRange(1, 5);
        const toggle = document.querySelector('#showDescription'); toggle.checked = true; toggle.dispatchEvent(new Event('input'));
    });
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(resolve)))));
    expect(await grid.evaluate(g => ({ same: g.shadowRoot.activeElement === builderBottom.e && g._table.contains(builderBottom.e),
        value: builderBottom.e.value, selection: [builderBottom.e.selectionStart, builderBottom.e.selectionEnd],
        committed: g.selectedObject[builderBottom.key], scrolled: g._table.scrollTop > builderBottom.top })))
        .toEqual({ same: true, value: 'Pending builder', selection: [1, 5], committed: expect.stringMatching(/^Value /), scrolled: true });
});

test('description height CSS edits keep a focused bottom row visible without visibility toggles or color resizes', async ({ page }) => {
    await load(page);
    const grid = page.locator('#styled');
    await grid.evaluate(async g => {
        g.typeDefinitions = [{ name: 'Example', properties: Array.from({ length: 150 }, (_, i) => ({ name: `field${i}`, type: 'string' })) }];
        g.selectedObject = Object.fromEntries(Array.from({ length: 150 }, (_, i) => [`field${i}`, `Value ${i}`]));
        await g.refresh();
        // Long description makes both min-height and max-height independently change the viewport.
        g.shadowRoot.querySelector('#descText').textContent = 'Description\n'.repeat(30);
        window.heightChanges = []; g.propertyChanged.on(e => heightChanges.push(e));
    });
    await expect(row(grid, 'field0').locator('input')).toBeVisible();
    await setControl(page, 'descriptionMinHeight', 24);
    await setControl(page, 'descriptionMaxHeight', 48);
    await page.locator('#descriptionMinHeightEnabled').check();
    await page.locator('#descriptionMaxHeightEnabled').check();
    await grid.locator('[part="tree"]').evaluate(e => e.scrollTop = 1400);
    await expect(row(grid, 'field58').locator('input')).toBeVisible();
    for (const [id, height] of [['descriptionMaxHeight', 160], ['descriptionMinHeight', 160]]) {
        if (id === 'descriptionMinHeight') await setControl(page, 'descriptionMaxHeight', 48);
        await grid.evaluate(g => {
            const table = g._table, bounds = table.getBoundingClientRect();
            const e = [...table.querySelectorAll('input')].filter(e => e.getBoundingClientRect().top >= bounds.top && e.getBoundingClientRect().bottom < bounds.bottom - 3).at(-1);
            e.focus(); e.value = 'Pending height'; e.setSelectionRange(2, 7);
            window.heightRetained = { e, row: e.closest('.wb-row'), key: e.closest('.wb-row').querySelector('.wb-title').textContent,
                tree: g._tree, object: g.selectedObject, height: table.clientHeight, top: table.scrollTop };
            heightChanges.length = 0;
        });
        await setControl(page, id, height);
        await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(resolve)))));
        const result = await grid.evaluate(g => {
            const { e, row, key, tree, object, height, top } = heightRetained, a = e.getBoundingClientRect(), b = g._table.getBoundingClientRect();
            return { same: g.shadowRoot.activeElement === e && g._table.contains(row) && row.contains(e), tree: g._tree === tree,
                object: g.selectedObject === object, pending: e.value, selection: [e.selectionStart, e.selectionEnd],
                committed: g.selectedObject[key], changes: heightChanges, visible: a.top >= b.top && a.bottom <= b.bottom,
                shrunk: g._table.clientHeight < height, scrolled: g._table.scrollTop > top, shown: g.showDescription };
        });
        expect(result).toEqual({ same: true, tree: true, object: true, pending: 'Pending height', selection: [2, 7],
            committed: expect.stringMatching(/^Value /), changes: [], visible: true, shrunk: true, scrolled: true, shown: true });
    }
    // Color-only style injection must not issue a tree resize.
    await grid.evaluate(g => {
        window.colorUpdates = 0;
        g._tree.setOption('update', () => colorUpdates++);
    });
    await setControl(page, 'background', '#123456');
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(resolve)))));
    expect(await page.evaluate(() => colorUpdates)).toBe(0);
});
