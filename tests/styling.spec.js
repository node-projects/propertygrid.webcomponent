import { test, expect } from '@playwright/test';

async function load(page) {
    await page.goto('/tests/fixture.html');
    await page.evaluate(() => import('/dist/index.js'));
}

function row(grid, name) {
    return grid.locator('[part~="row"]').filter({ has: grid.page().locator('[part~="property-name"]', { hasText: name }) });
}

async function waitForEditors(page, id = 'grid') {
    await expect(page.locator(`#${id} [part~="editor-text"]`).first()).toBeVisible();
}

test('default appearance, inherited theme through shadow wrapper, and direct Wunderbaum overrides', async ({ page }) => {
    await load(page);
    await page.evaluate(() => {
        const ancestor = document.createElement('section');
        ancestor.style.cssText = `--pg-background: rgb(20, 30, 40); --pg-color: rgb(230, 240, 250);
            --pg-font-family: monospace; --pg-font-size: 15px; --pg-border-color: rgb(60, 70, 80);
            --pg-grid-color: rgb(70, 80, 90); --pg-focus-color: rgb(100, 110, 120);
            --pg-hover-background: rgb(40, 50, 60); --pg-selected-background: rgb(50, 60, 70);
            --pg-selected-hover-background: rgb(50, 60, 70);
            --pg-header-background: rgb(30, 40, 50); --pg-header-color: rgb(200, 210, 220);
            --pg-header-padding: 6px; --pg-description-background: rgb(40, 50, 60);
            --pg-description-color: rgb(210, 220, 230); --pg-description-padding: 7px;
            --pg-editor-background: rgb(25, 35, 45); --pg-editor-color: rgb(220, 230, 240);
            --pg-editor-border: 1px solid rgb(80, 90, 100); --pg-editor-radius: 3px;
            --pg-expander-opacity: 0.6;`;
        const wrapper = document.createElement('div');
        const shadow = wrapper.attachShadow({ mode: 'open' });
        ancestor.append(wrapper);
        document.body.append(ancestor);
        createGrid(shadow, 'themed');
        createGrid(document.body, 'plain');
    });
    await waitForEditors(page, 'themed');
    await waitForEditors(page, 'plain');
    const themed = page.locator('#themed');
    const plain = page.locator('#plain');
    await expect(themed.locator('[part="tree"]')).toHaveCSS('background-color', 'rgb(20, 30, 40)');
    await expect(themed.locator('[part="tree"]')).toHaveCSS('color', 'rgb(230, 240, 250)');
    await expect(themed.locator('[part="tree"]')).toHaveCSS('font-size', '15px');
    await expect(themed.locator('[part="header"]')).toHaveCSS('background-color', 'rgb(30, 40, 50)');
    await expect(themed.locator('[part="header"]')).toHaveCSS('padding-left', '6px');
    await expect(themed.locator('[part="description"]')).toHaveCSS('background-color', 'rgb(40, 50, 60)');
    await expect(themed.locator('[part="description"]')).toHaveCSS('color', 'rgb(210, 220, 230)');
    await expect(themed.locator('[part="description"]')).toHaveCSS('font-family', 'monospace');
    const input = themed.locator('[part~="editor-text"]').first();
    await expect(input).toHaveCSS('background-color', 'rgb(25, 35, 45)');
    await expect(input).toHaveCSS('color', 'rgb(220, 230, 240)');
    await expect(input).toHaveCSS('border-top-color', 'rgb(80, 90, 100)');
    await expect(input).toHaveCSS('border-radius', '3px');
    await expect(themed.locator('[part~="expander"]').first()).toHaveCSS('opacity', '0.6');
    await expect(plain.locator('[part="tree"]')).toHaveCSS('background-color', 'rgb(255, 255, 255)');
    await expect(plain.locator('[part="tree"]')).toHaveCSS('color', 'rgb(86, 83, 76)');
    await expect(plain.locator('[part="tree"]')).toHaveCSS('font-size', '14px');
    await expect(plain.locator('[part="header"]')).toHaveCSS('background-color', 'rgb(240, 240, 240)');
    await expect(plain.locator('[part="description"]')).toHaveCSS('background-color', 'rgb(230, 230, 230)');
    await expect(plain.locator('[part~="row"]').first()).toHaveCSS('height', '22px');
    await expect(plain.locator('[part~="editor-text"]').first()).toHaveCSS('border-top-width', '2px');
    await row(themed, 'title').locator('[part~="property-name"]').click();
    await expect(themed.locator('[part="description-title"]')).toHaveText('title');
    await expect(themed.locator('[part="description-text"]')).toHaveText('Title description');
    await row(themed, 'title').hover();
    await expect(row(themed, 'title')).toHaveCSS('background-color', 'rgb(50, 60, 70)');
    await row(themed, 'count').hover();
    await expect(row(themed, 'count')).toHaveCSS('background-color', 'rgb(40, 50, 60)');
    await input.focus();
    await expect(themed.locator('[part="tree"]')).toHaveCSS('border-top-color', 'rgb(100, 110, 120)');
    await themed.evaluate(grid => grid.style.setProperty('--wb-background-color', 'rgb(90, 80, 70)'));
    await expect(themed.locator('[part="tree"]')).toHaveCSS('background-color', 'rgb(90, 80, 70)');
});

test('additional sheets before readiness, replacement, clearing, defensive lists and native errors', async ({ page }) => {
    await load(page);
    await page.evaluate(() => {
        const grid = createGrid();
        const sheet = new CSSStyleSheet();
        sheet.replaceSync(':host { --pg-header-background: rgb(1, 2, 3); }');
        const list = [sheet];
        grid.additionalStyleSheets = list;
        list.length = 0;
        grid.additionalStyleSheets.length = 0;
        createGrid(document.body, 'plain');
    });
    await waitForEditors(page);
    const grid = page.locator('#grid');
    await expect(grid.locator('[part="header"]')).toHaveCSS('background-color', 'rgb(1, 2, 3)');
    await expect(page.locator('#plain [part="header"]')).toHaveCSS('background-color', 'rgb(240, 240, 240)');
    expect(await grid.evaluate(grid => [grid.additionalStyleSheets.length, grid.shadowRoot.adoptedStyleSheets.length])).toEqual([1, 3]);
    await grid.evaluate(grid => {
        const sheet = new CSSStyleSheet();
        sheet.replaceSync(':host { --pg-header-color: rgb(4, 5, 6); }');
        grid.additionalStyleSheets = [sheet];
    });
    await expect(grid.locator('[part="header"]')).toHaveCSS('background-color', 'rgb(240, 240, 240)');
    await expect(grid.locator('[part="header"]')).toHaveCSS('color', 'rgb(4, 5, 6)');
    const error = await grid.evaluate(async grid => {
        const frame = document.createElement('iframe');
        const loaded = new Promise(resolve => frame.onload = resolve);
        document.body.append(frame);
        await loaded;
        const sheet = new frame.contentWindow.CSSStyleSheet();
        try { grid.additionalStyleSheets = [sheet]; } catch (error) { return error.name; }
    });
    expect(error).toBe('NotAllowedError');
    expect(await grid.evaluate(grid => grid.additionalStyleSheets.length)).toBe(1);
    await grid.evaluate(grid => grid.additionalStyleSheets = []);
    expect(await grid.evaluate(grid => grid.shadowRoot.adoptedStyleSheets.length)).toBe(2);
    await expect(grid.locator('[part="header"]')).not.toHaveCSS('color', 'rgb(4, 5, 6)');
});

test('unstyled custom native roots and wrapped controls retain simple and layered author styles', async ({ page }) => {
    await load(page);
    await page.evaluate(() => {
        for (const [id, selector, layered] of [['class', '.legacy-control', false], ['native', 'input', false], ['layered', '.legacy-control', true]]) {
            const grid = createGrid(document.body, id);
            grid.typeDefinitions = [{ name: 'Example', properties: [{ name: 'title', type: 'string' }, { name: 'wrapped', type: 'string' }] }];
            grid.getSpecialEditorForType = async property => {
                const input = document.createElement('input');
                input.className = 'legacy-control';
                if (property.name === 'title') return input;
                const wrapper = document.createElement('div');
                wrapper.append(input);
                return wrapper;
            };
            const sheet = new CSSStyleSheet();
            const rules = `${selector} { background: rgb(11, 22, 33); color: rgb(44, 55, 66);
                padding: 3px; border-radius: 7px; font-family: monospace; font-size: 16px;
                accent-color: rgb(77, 88, 99); outline-color: rgb(100, 110, 120); }`;
            sheet.replaceSync(layered ? `@layer application { ${rules} }` : rules);
            grid.additionalStyleSheets = [sheet];
        }
    });
    for (const id of ['class', 'native', 'layered']) {
        await waitForEditors(page, id);
        await expect(page.locator(`#${id} .legacy-control`)).toHaveCount(2);
        for (const input of await page.locator(`#${id} .legacy-control`).all()) {
            await expect(input).toHaveCSS('background-color', 'rgb(11, 22, 33)');
            await expect(input).toHaveCSS('color', 'rgb(44, 55, 66)');
            await expect(input).toHaveCSS('padding', '3px');
            await expect(input).toHaveCSS('border-radius', '7px');
            await expect(input).toHaveCSS('font-family', 'monospace');
            await expect(input).toHaveCSS('font-size', '16px');
            await expect(input).toHaveCSS('accent-color', 'rgb(77, 88, 99)');
            await expect(input).toHaveCSS('border-top-width', '2px');
            await input.focus();
            await expect(input).toHaveCSS('outline-color', 'rgb(100, 110, 120)');
        }
    }
});

test('header inherits ancestor weight unless the header theme opts in', async ({ page }) => {
    await load(page);
    await page.evaluate(() => {
        const ancestor = document.createElement('section');
        ancestor.style.fontWeight = 'bold';
        document.body.append(ancestor);
        createGrid(ancestor);
    });
    await waitForEditors(page);
    const grid = page.locator('#grid');
    await expect(grid.locator('[part="header"]')).toHaveCSS('font-weight', '700');
    await grid.evaluate(grid => grid.style.setProperty('--pg-header-font-weight', '400'));
    await expect(grid.locator('[part="header"]')).toHaveCSS('font-weight', '400');
});

test('hover border input colors ordinary rows while missing inputs preserve grid and focus borders', async ({ page }) => {
    await load(page);
    await page.evaluate(() => createGrid());
    await waitForEditors(page);
    const grid = page.locator('#grid');
    const hovered = row(grid, 'title');
    await hovered.hover();
    await expect(hovered).toHaveCSS('border-top-color', 'rgba(0, 0, 0, 0)');
    await expect(hovered).toHaveCSS('border-left-color', 'rgba(0, 0, 0, 0)');
    await expect(hovered).toHaveCSS('border-right-color', 'rgba(0, 0, 0, 0)');
    await expect(hovered).toHaveCSS('border-bottom-color', 'rgb(222, 222, 222)');
    await hovered.evaluate(row => row.classList.add('wb-focus'));
    await expect(hovered).toHaveCSS('border-top-style', 'dotted');
    await expect(hovered).toHaveCSS('border-top-color', 'rgb(112, 192, 231)');
    await expect(hovered).toHaveCSS('border-bottom-color', 'rgb(222, 222, 222)');
    await grid.evaluate(grid => grid.style.setProperty('--pg-hover-border-color', 'rgb(10, 20, 30)'));
    for (const side of ['top', 'left', 'right', 'bottom'])
        await expect(hovered).toHaveCSS(`border-${side}-color`, 'rgb(10, 20, 30)');
    await hovered.evaluate(row => row.classList.remove('wb-focus'));
    await expect(hovered).toHaveCSS('border-top-color', 'rgb(10, 20, 30)');
    await hovered.evaluate(row => row.classList.add('wb-active'));
    await expect(hovered).not.toHaveCSS('border-top-color', 'rgb(10, 20, 30)');
    await hovered.evaluate(row => { row.classList.remove('wb-active'); row.classList.add('wb-selected'); });
    await expect(hovered).not.toHaveCSS('border-top-color', 'rgb(10, 20, 30)');
});

test('pre-upgrade options and initial row-height survive readiness; invalid setters retain state', async ({ page }) => {
    await page.goto('/tests/fixture.html');
    await page.evaluate(() => {
        const grid = createGrid();
        grid.rowHeight = 31;
        const sheet = new CSSStyleSheet();
        sheet.replaceSync(':host { --pg-header-background: rgb(7, 8, 9); }');
        grid.additionalStyleSheets = [sheet];
        const attributed = document.createElement('node-projects-property-grid');
        attributed.id = 'attributed';
        attributed.setAttribute('row-height', '26');
        document.body.append(attributed);
    });
    await page.evaluate(() => import('/dist/index.js'));
    await waitForEditors(page);
    const grid = page.locator('#grid');
    await expect(grid.locator('[part="header"]')).toHaveCSS('background-color', 'rgb(7, 8, 9)');
    await expect(grid.locator('[part~="row"]').first()).toHaveCSS('height', '31px');
    expect(await grid.evaluate(grid => [grid.rowHeight, grid._tree.options.rowHeightPx])).toEqual([31, 31]);
    expect(await page.locator('#attributed').evaluate(grid => [grid.rowHeight, grid._tree.options.rowHeightPx])).toEqual([26, 26]);
    const rejected = await grid.evaluate(grid => [NaN, Infinity, -Infinity, 3.9, -1, '28', null, undefined, {}, 22n].map(value => {
        try { grid.rowHeight = value; return 'accepted'; } catch (error) { return error.name; }
    }));
    expect(rejected).toEqual(Array(10).fill('RangeError'));
    expect(await grid.evaluate(grid => [grid.rowHeight, grid._tree.options.rowHeightPx])).toEqual([31, 31]);
    await grid.evaluate(grid => grid.rowHeight = 4);
    await expect(grid.locator('[part~="row"]').first()).toHaveCSS('height', '4px');
    await grid.evaluate(grid => grid.rowHeight = 22.5);
    await expect(grid.locator('[part~="row"]').first()).toHaveCSS('height', '22.5px');
});

test('live density preserves active editor, focus, selection and correct virtual row spacing', async ({ page }) => {
    await load(page);
    await page.evaluate(() => {
        const grid = createGrid();
        grid.typeDefinitions = [{ name: 'Example', properties: Array.from({ length: 160 }, (_, i) => ({ name: `field${i}`, type: 'string' })) }];
        grid.selectedObject = Object.fromEntries(Array.from({ length: 160 }, (_, i) => [`field${i}`, `Value ${i}`]));
    });
    await waitForEditors(page);
    const grid = page.locator('#grid');
    const input = row(grid, 'field0').locator('input');
    await input.fill('Still editing');
    await input.evaluate(input => { input.focus(); input.setSelectionRange(2, 5); window.activeEditor = input; });
    await grid.evaluate(grid => grid.rowHeight = 34);
    expect(await grid.evaluate(grid => {
        const rows = [...grid.shadowRoot.querySelectorAll('[part~="row"]')];
        const tops = rows.map(row => parseFloat(row.style.top));
        return {
            same: grid.shadowRoot.activeElement === window.activeEditor,
            value: window.activeEditor.value,
            selection: [window.activeEditor.selectionStart, window.activeEditor.selectionEnd],
            numeric: grid._tree.options.rowHeightPx,
            spacing: tops.slice(1).every((top, i) => top - tops[i] === 34),
            inner: getComputedStyle(rows[0].querySelector('[part~="property-value"]')).height
        };
    })).toEqual({ same: true, value: 'Still editing', selection: [2, 5], numeric: 34, spacing: true, inner: '32px' });
    await grid.evaluate(grid => grid.rowHeight = 22);
    await expect(input).toHaveValue('Still editing');
    expect(await grid.evaluate(grid => grid.shadowRoot.activeElement === window.activeEditor)).toBe(true);
    await grid.locator('[part="header"]').click();
    expect(await grid.evaluate(grid => grid.selectedObject.field0)).toBe('Still editing');
    await grid.locator('[part="tree"]').evaluate(tree => tree.scrollTop = 2200);
    await expect(row(grid, 'field100').locator('input')).toBeVisible();
    expect(await grid.evaluate(grid => [...grid.shadowRoot.querySelectorAll('[part~="row"]')].every(row => parseFloat(row.style.top) % 22 === 0))).toBe(true);
});

test('initial row-height uses one base-compatible decimal parse and rejects without transient geometry', async ({ page }) => {
    await load(page);
    const results = await page.evaluate(async () => {
        const grids = ['28', '28px', '28malformed', '2.8e1', '0x20', '', 'invalid', '3.9', 'Infinity'].map(value => {
            const grid = document.createElement('node-projects-property-grid');
            grid.rowHeight = 31;
            grid.setAttribute('row-height', value);
            const applied = [];
            const apply = grid._applyRowHeight;
            grid._applyRowHeight = function () { applied.push(this.rowHeight); apply.call(this); };
            const ready = grid.ready;
            grid.ready = function () { try { ready.call(this); } catch (error) { this.failure = error.name; } };
            document.body.append(grid);
            return { grid, applied };
        });
        await new Promise(resolve => queueMicrotask(resolve));
        return grids.map(({ grid, applied }) => ({ height: grid.rowHeight, numeric: grid._tree?.options.rowHeightPx ?? null,
            css: grid._table.style.getPropertyValue('--wb-row-outer-height'), failure: grid.failure ?? null, applied }));
    });
    expect(results.slice(0, 4)).toEqual(Array(4).fill({ height: 28, numeric: 28, css: '28px', failure: null, applied: [28, 28] }));
    expect(results.slice(4)).toEqual(Array(5).fill({ height: 31, numeric: null, css: '31px', failure: 'RangeError', applied: [] }));
});

test('parts style categories, objects and leaves, and survive collapse, expansion, refresh and virtualization', async ({ page }) => {
    await load(page);
    await page.evaluate(() => {
        const style = document.createElement('style');
        style.textContent = `#grid::part(category-row) { background: rgb(10, 20, 30); }
            #grid::part(object-row) { color: rgb(40, 50, 60); }
            #grid::part(property-name) { font-style: italic; }
            #grid::part(editor) { border-radius: 6px; }
            #grid::part(expander) { opacity: 0.4; }`;
        document.head.append(style);
        const grid = createGrid();
        definitions[0].properties.push(...Array.from({ length: 100 }, (_, i) => ({ name: `tail${i}`, type: 'string', category: 'General' })));
    });
    await waitForEditors(page);
    const grid = page.locator('#grid');
    await grid.evaluate(grid => grid._tree.root.expandAll(true));
    await expect(grid.locator('[part~="category-row"]')).toHaveCSS('background-color', 'rgb(10, 20, 30)');
    await expect(grid.locator('[part~="object-row"]')).toHaveCSS('color', 'rgb(40, 50, 60)');
    await expect(grid.locator('[part~="property-name"]').first()).toHaveCSS('font-style', 'italic');
    await expect(grid.locator('[part~="expander"]').first()).toHaveCSS('opacity', '0.4');
    await grid.evaluate(async grid => {
        const category = grid._tree.root.children.find(node => node.title === '[General]');
        await category.setExpanded(false);
        await category.setExpanded(true);
        const nested = grid._tree.root.children.find(node => node.title === 'nested');
        await nested.setExpanded(false);
        await nested.setExpanded(true);
    });
    await expect(row(grid, 'grouped').locator('[part~="editor-text"]')).toHaveCSS('border-radius', '6px');
    await expect(row(grid, 'child').locator('[part~="editor-text"]')).toHaveCSS('border-radius', '6px');
    await grid.locator('[part="tree"]').evaluate(tree => tree.scrollTop = 1500);
    await expect(row(grid, 'tail60').locator('[part~="editor-text"]')).toHaveCSS('border-radius', '6px');
    await grid.locator('[part="tree"]').evaluate(tree => tree.scrollTop = 0);
    await expect(grid.locator('[part~="category-row"]')).toHaveCSS('background-color', 'rgb(10, 20, 30)');
    await expect(grid.locator('[part~="object-row"]')).toHaveCSS('color', 'rgb(40, 50, 60)');
    await grid.evaluate(grid => grid.refresh());
    await expect(row(grid, 'title').locator('[part~="editor-text"]')).toHaveCSS('border-radius', '6px');
});

test('styled nullable, enum, boolean and any editors keep existing value behavior and visibility', async ({ page }) => {
    await load(page);
    await page.evaluate(() => {
        const grid = createGrid();
        grid.style.cssText = '--pg-editor-background: rgb(12, 23, 34); --pg-editor-color: white; --pg-editor-accent-color: red;';
        window.changes = [];
        grid.propertyChanged.on(event => changes.push(event));
    });
    await waitForEditors(page);
    const grid = page.locator('#grid');
    const count = row(grid, 'count');
    await expect(count.locator('[part~="nullable-editor"]')).toBeVisible();
    await count.locator('[part~="editor-number"]').fill('42');
    await grid.locator('[part="header"]').click();
    expect(await grid.evaluate(grid => grid.selectedObject.count)).toBe(42);
    await count.locator('[part~="nullable-toggle"]').uncheck();
    expect(await grid.evaluate(grid => grid.selectedObject.count)).toBeNull();
    const boolean = row(grid, 'enabled').locator('[part~="editor-checkbox"]');
    await boolean.uncheck();
    await grid.locator('[part="header"]').click();
    expect(await grid.evaluate(grid => grid.selectedObject.enabled)).toBe(false);
    await row(grid, 'mode').locator('[part~="editor-select"]').selectOption('b');
    expect(await grid.evaluate(grid => grid.selectedObject.mode)).toBe('b');
    const any = row(grid, 'extra');
    const selector = any.locator('[part~="any-type-selector"]');
    await expect(any.locator('[part~="editor-text"]')).toBeVisible();
    await expect(any.locator('[part~="editor-number"]')).toBeHidden();
    await expect(any.locator('[part~="editor-checkbox"]')).toBeHidden();
    await selector.selectOption('number');
    await any.locator('[part~="editor-number"]').fill('17');
    await grid.locator('[part="header"]').click();
    expect(await grid.evaluate(grid => grid.selectedObject.extra)).toBe(17);
    await expect(any.locator('[part~="editor-text"]')).toBeHidden();
    await expect(any.locator('[part~="editor-checkbox"]')).toBeHidden();
    await selector.selectOption('string');
    await any.locator('[part~="editor-text"]').fill('Edited notes');
    await grid.locator('[part="header"]').click();
    expect(await grid.evaluate(grid => grid.selectedObject.extra)).toBe('Edited notes');
    await expect(any.locator('[part~="editor-number"]')).toBeHidden();
    await expect(any.locator('[part~="editor-checkbox"]')).toBeHidden();
    await selector.selectOption('boolean');
    await any.locator('[part~="editor-checkbox"]').uncheck();
    await grid.locator('[part="header"]').click();
    expect(await grid.evaluate(grid => grid.selectedObject.extra)).toBe(false);
    await selector.selectOption('null');
    expect(await grid.evaluate(grid => grid.selectedObject.extra)).toBeNull();
    await expect(any.locator('input:visible')).toHaveCount(0);
    expect(await page.evaluate(() => changes.some(event => event.property === 'count' && event.newValue === 42))).toBe(true);
});

test('any editor shares cell width without overlap in native and themed layouts', async ({ page }) => {
    await load(page);
    await page.evaluate(() => createGrid());
    const grid = page.locator('#grid'); await waitForEditors(page);
    const any = row(grid, 'extra'), selector = any.locator('[part~="any-type-selector"]');
    for (const theme of ['', '--pg-editor-height: 20px; --pg-editor-padding-inline: 4px']) {
        await grid.evaluate((g, theme) => g.style.cssText = theme, theme);
        for (const width of [440, 320, 220]) {
            await grid.evaluate((g, width) => g.style.width = `${width}px`, width);
            for (const type of ['string', 'number', 'boolean', 'null']) {
                await selector.selectOption(type);
                const bounds = await any.locator('[part~="property-value"]').evaluate(cell => {
                    const rect = cell.getBoundingClientRect();
                    const wrapper = cell.querySelector('[part~="any-editor"]').getBoundingClientRect();
                    const select = cell.querySelector('select').getBoundingClientRect();
                    const input = [...cell.querySelectorAll('input')].find(e => e.getBoundingClientRect().width);
                    const value = input?.getBoundingClientRect();
                    return { wrapperRight: rect.right - wrapper.right, selectWidth: select.width,
                        valueWidth: value?.width, valueRight: value && rect.right - value.right,
                        gap: value && value.left - select.right };
                });
                expect(bounds.wrapperRight, `${width}px ${type}`).toBeGreaterThanOrEqual(0);
                expect(bounds.selectWidth).toBeGreaterThan(0);
                if (type !== 'null') {
                    expect(bounds.valueWidth).toBeGreaterThan(0);
                    expect(bounds.valueRight, `${width}px ${type}`).toBeGreaterThanOrEqual(0);
                    expect(bounds.gap, `${width}px ${type}`).toBeGreaterThanOrEqual(4);
                }
            }
        }
    }
});

test('custom editor root and native descendants get additive parts, sheets stay outside nested shadows', async ({ page }) => {
    await load(page);
    await page.evaluate(() => {
        customElements.define('test-shadow-editor', class extends HTMLElement {
            constructor() { super(); this.attachShadow({ mode: 'open' }).innerHTML = '<input value="Encapsulated">'; }
        });
        const grid = createGrid();
        grid.getSpecialEditorForType = async property => {
            if (property.name !== 'title') return null;
            const root = document.createElement('div');
            root.className = 'custom-editor';
            root.setAttribute('part', 'consumer-root');
            root.innerHTML = '<input part="consumer-input"><select><option>a</option></select><textarea></textarea><button>Action</button><test-shadow-editor></test-shadow-editor>';
            return root;
        };
        const sheet = new CSSStyleSheet();
        sheet.replaceSync('.custom-editor input { background: rgb(100, 120, 140); }');
        grid.additionalStyleSheets = [sheet];
    });
    await waitForEditors(page);
    const grid = page.locator('#grid');
    const custom = grid.locator('.custom-editor');
    await expect(custom).toHaveAttribute('part', /consumer-root/);
    await expect(custom).toHaveAttribute('part', /editor/);
    await expect(custom.locator('input[part~="consumer-input"]')).toHaveAttribute('part', /editor-text/);
    await expect(custom.locator('select')).toHaveAttribute('part', /editor-select/);
    await expect(custom.locator('textarea')).toHaveAttribute('part', /editor-textarea/);
    await expect(custom.locator('button')).toHaveAttribute('part', /editor-button/);
    await expect(custom.locator('input[part~="consumer-input"]')).toHaveCSS('background-color', 'rgb(100, 120, 140)');
    const nested = custom.locator('test-shadow-editor input');
    await expect(nested).not.toHaveAttribute('part');
    await expect(nested).not.toHaveCSS('background-color', 'rgb(100, 120, 140)');
    await grid.evaluate(grid => grid.additionalStyleSheets = []);
    await expect(custom.locator('input[part~="consumer-input"]')).not.toHaveCSS('background-color', 'rgb(100, 120, 140)');
});

test('async editor targets are marked synchronously, obsolete results discarded, detached grids still render', async ({ page }) => {
    await load(page);
    await page.evaluate(() => {
        const grid = createGrid();
        window.pending = [];
        grid.getSpecialEditorForType = async property => {
            if (property.name !== 'title') return null;
            return new Promise(resolve => pending.push(resolve));
        };
    });
    const grid = page.locator('#grid');
    await expect.poll(() => page.evaluate(() => pending.length)).toBe(1);
    await expect(row(grid, 'title').locator('[part~="property-value"]')).toBeVisible();
    await expect(grid.locator('[part~="category-row"]')).toHaveCount(1);
    await expect(grid.locator('[part~="object-row"]')).toHaveCount(1);
    await page.evaluate(async () => {
        window.obsoleteRow = document.querySelector('#grid').shadowRoot.querySelector('[part~="row"]');
        await document.querySelector('#grid').refresh();
    });
    await expect.poll(() => page.evaluate(() => pending.length)).toBe(2);
    await page.evaluate(() => {
        const stale = document.createElement('input');
        stale.id = 'stale';
        pending.shift()(stale);
    });
    await expect(grid.locator('#stale')).toHaveCount(0);
    expect(await page.evaluate(() => obsoleteRow.querySelector('#stale') === null)).toBe(true);
    await page.evaluate(() => {
        const fresh = document.createElement('input');
        fresh.id = 'fresh';
        pending.shift()(fresh);
    });
    await expect(grid.locator('#fresh')).toHaveAttribute('part', /editor-text/);
    expect(await page.evaluate(async () => {
        const detached = createGrid(document.createDocumentFragment(), 'detached');
        detached.rowHeight = 28;
        await new Promise(resolve => setTimeout(resolve, 100));
        return { connected: detached.isConnected, editor: !!detached.shadowRoot.querySelector('[part~="editor-text"]'), height: detached._tree.options.rowHeightPx };
    })).toEqual({ connected: false, editor: true, height: 28 });
});

test('custom connected and delayed light-DOM controls get parts across realms, not unrelated or shadow controls', async ({ page }) => {
    await load(page);
    await page.evaluate(async () => {
        const frame = document.createElement('iframe');
        const loaded = new Promise(resolve => frame.onload = resolve);
        document.body.append(frame);
        await loaded;
        window.foreignInput = frame.contentDocument.createElement('input');
        foreignInput.type = 'radio';
        foreignInput.setAttribute('part', 'consumer-radio');
        customElements.define('test-connected-editor', class extends HTMLElement {
            connectedCallback() {
                this.innerHTML = '<input part="consumer-connected"><select><option>a</option></select>';
                this.attachShadow({ mode: 'open' }).innerHTML = '<slot></slot><input>';
                this.append(foreignInput);
            }
        });
        const grid = createGrid();
        grid.getSpecialEditorForType = async property => property.name === 'title' ? document.createElement('test-connected-editor') : null;
    });
    await waitForEditors(page);
    const grid = page.locator('#grid');
    const custom = grid.locator('test-connected-editor');
    await expect(custom.locator('[part~="consumer-connected"]')).toHaveAttribute('part', /editor-input/);
    await expect(custom.locator('[part~="consumer-connected"]')).toHaveAttribute('part', /editor-text/);
    await expect(custom.locator('select')).toHaveAttribute('part', /editor-select/);
    await expect(custom.locator('[part~="consumer-radio"]')).toHaveAttribute('part', /editor-input/);
    await expect(custom.locator('[part~="consumer-radio"]')).toHaveAttribute('part', /editor-radio/);
    expect(await page.evaluate(() => foreignInput instanceof HTMLInputElement)).toBe(false);
    await custom.evaluate(root => {
        const delayed = document.createElement('div');
        delayed.innerHTML = '<input type="number" part="consumer-delayed"><textarea></textarea><button>Later</button>';
        root.append(delayed);
    });
    await expect(custom.locator('[part~="consumer-delayed"]')).toHaveAttribute('part', /editor-number/);
    await expect(custom.locator('textarea')).toHaveAttribute('part', /editor-textarea/);
    await expect(custom.locator('button')).toHaveAttribute('part', /editor-button/);
    await grid.evaluate(async grid => {
        const unrelated = document.createElement('input');
        unrelated.id = 'unrelated';
        grid._table.querySelector('[part~="property-name"]').append(unrelated);
        grid._table.append(document.createElement('input'));
        await new Promise(resolve => queueMicrotask(resolve));
    });
    await expect(grid.locator('#unrelated')).not.toHaveAttribute('part');
    expect(await grid.evaluate(grid => grid._table.lastElementChild.hasAttribute('part'))).toBe(false);
    expect(await custom.evaluate(root => root.shadowRoot.querySelector('input').hasAttribute('part'))).toBe(false);
    // Attribute edits alone do not trigger another part-marking pass.
    await custom.evaluate(async root => {
        root.querySelector('[part~="consumer-delayed"]').setAttribute('part', 'consumer-delayed');
        await new Promise(resolve => queueMicrotask(resolve));
    });
    await expect(custom.locator('[part~="consumer-delayed"]')).toHaveAttribute('part', 'consumer-delayed');
});

test('obsolete special any fallback cannot mutate replacement values or emit obsolete changes', async ({ page }) => {
    await load(page);
    await page.evaluate(() => {
        const grid = createGrid();
        grid.typeDefinitions = [{ name: 'Example', properties: [{ name: 'extra', type: 'any' }] }];
        window.pending = [];
        window.changes = [];
        grid.propertyChanged.on(event => changes.push(event));
        grid.getSpecialEditorForType = async () => new Promise(resolve => pending.push(resolve));
    });
    const grid = page.locator('#grid');
    await expect.poll(() => page.evaluate(() => pending.length)).toBe(1);
    await grid.evaluate(grid => grid.selectedObject = { extra: 'Replacement' });
    await expect.poll(() => page.evaluate(() => pending.length)).toBe(2);
    await page.evaluate(async () => {
        pending.shift()(null);
        await new Promise(resolve => setTimeout(resolve, 20));
    });
    expect(await grid.evaluate(grid => grid.selectedObject.extra)).toBe('Replacement');
    expect(await page.evaluate(() => changes)).toEqual([]);
    await page.evaluate(() => pending.shift()(null));
    await expect(grid.locator('[part~="editor-text"]')).toHaveValue('Replacement');
    expect(await page.evaluate(() => changes)).toEqual([{ property: 'extra', newValue: 'Replacement' }]);
    expect(await grid.evaluate(async grid => {
        grid.getSpecialEditorForType = async () => null;
        const editor = await grid.getEditorForType({ type: 'string' }, 'Public editor', 'title');
        return editor.value;
    })).toBe('Public editor');
});

test('virtualization discards late editors even when the tree update version is unchanged', async ({ page }) => {
    await load(page);
    await page.evaluate(() => {
        const grid = createGrid();
        grid.typeDefinitions = [{ name: 'Example', properties: Array.from({ length: 160 }, (_, i) => ({ name: `field${i}`, type: 'string' })) }];
        window.pending = [];
        grid.getSpecialEditorForType = async property => {
            if (property.name !== 'field0') return null;
            return new Promise(resolve => pending.push(resolve));
        };
        grid.selectedObject = {};
    });
    const grid = page.locator('#grid');
    await expect.poll(() => page.evaluate(() => pending.length)).toBe(1);
    await grid.evaluate(grid => {
        window.originalVersion = grid._updateVersion;
        window.obsoleteCell = grid.shadowRoot.querySelector('[part~="property-value"]');
    });
    await grid.locator('[part="tree"]').evaluate(tree => tree.scrollTop = 2200);
    await expect(row(grid, 'field100').locator('input')).toBeVisible();
    await grid.locator('[part="tree"]').evaluate(tree => tree.scrollTop = 0);
    await expect.poll(() => page.evaluate(() => pending.length)).toBe(2);
    await page.evaluate(() => {
        const stale = document.createElement('input');
        stale.id = 'stale';
        pending.shift()(stale);
    });
    await expect(grid.locator('#stale')).toHaveCount(0);
    expect(await grid.evaluate(grid => ({ sameVersion: grid._updateVersion === originalVersion, discarded: !obsoleteCell.querySelector('#stale') }))).toEqual({ sameVersion: true, discarded: true });
    await page.evaluate(() => pending.shift()(document.createElement('input')));
    await expect(row(grid, 'field0').locator('[part~="editor-text"]')).toBeVisible();
});

for (const count of [13, 40]) test(`auto-height grid retains all ${count} fields after selection and refresh`, async ({ page }) => {
    await load(page);
    await page.evaluate(count => {
        const container = document.createElement('section');
        container.style.cssText = 'height: 550px; overflow: auto;';
        const section = document.createElement('div');
        section.style.height = 'fit-content';
        container.append(section);
        document.body.append(container);
        const grid = createGrid(section);
        grid.style.height = '100%';
        grid.showHead = false;
        grid.showDescription = false;
        grid.noCategory = true;
        grid.rowHeight = 48;
        grid.typeDefinitions = [{ name: 'Example', properties: Array.from({ length: count }, (_, i) => ({ name: `field${i}`, type: 'string' })) }];
        grid.getSpecialEditorForType = async () => {
            await new Promise(resolve => setTimeout(resolve, 100));
            return null;
        };
        grid.selectedObject = Object.fromEntries(Array.from({ length: count }, (_, i) => [`field${i}`, `Initial ${i}`]));
    }, count);
    const grid = page.locator('#grid');
    await expect(grid.locator('[part~="editor-text"]')).toHaveCount(count);
    const height = await grid.locator('[part="tree"]').evaluate(tree => tree.clientHeight);
    for (const preset of ['FA', 'SRM']) {
        await grid.evaluate((grid, { count, preset }) => {
            grid.selectedObject = Object.fromEntries(Array.from({ length: count }, (_, i) => [`field${i}`, `${preset} ${i}`]));
            if (preset === 'SRM') grid.selectedObject = grid.selectedObject;
        }, { count, preset });
        await expect(row(grid, 'field0').locator('input')).toHaveValue(`${preset} 0`);
        await expect(grid.locator('[part~="row"]')).toHaveCount(count);
        await expect(grid.locator('[part~="editor-text"]')).toHaveCount(count);
        await expect(row(grid, `field${count - 1}`).locator('input')).toHaveValue(`${preset} ${count - 1}`);
        expect(await grid.locator('[part="tree"]').evaluate(tree => tree.clientHeight)).toBe(height);
    }
    await grid.evaluate(grid => grid.refresh());
    await expect(grid.locator('[part~="row"]')).toHaveCount(count);
    await expect(grid.locator('[part~="editor-text"]')).toHaveCount(count);
    await expect(row(grid, `field${count - 1}`).locator('input')).toHaveValue(`SRM ${count - 1}`);
});

test('asynchronous type resolution keeps nested rows, descriptions and context-menu events', async ({ page }) => {
    await load(page);
    await page.evaluate(() => {
        const grid = createGrid();
        grid.getTypeInfo = async (_object, type) => {
            await new Promise(resolve => setTimeout(resolve, 10));
            return definitions.find(definition => definition.name === type);
        };
        grid.propertyNodeContextMenu.on(event => window.contextEvent = { propertyPath: event.propertyPath, value: event.value, name: event.property.name });
    });
    await waitForEditors(page);
    const grid = page.locator('#grid');
    await expect(grid.locator('[part~="object-row"]')).toHaveCount(1);
    const title = row(grid, 'title').locator('[part~="property-name"]');
    await title.click({ button: 'right' });
    expect(await page.evaluate(() => contextEvent)).toEqual({ propertyPath: 'title', value: 'Hello', name: 'title' });
    await title.click();
    await expect(grid.locator('[part="description-text"]')).toHaveText('Title description');
    await row(grid, 'child').locator('input').fill('Changed child');
    await grid.locator('[part="header"]').click();
    expect(await grid.evaluate(grid => grid.selectedObject.nested.child)).toBe('Changed child');
});

test('both browser samples load using concrete ESM import maps', async ({ page }) => {
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('/sample/index.html');
    await expect(page.locator('[part~="editor"]').first()).toBeVisible();
    await page.goto('/sample/themed.html');
    await expect(page.locator('#styled [part~="editor"]').first()).toBeVisible();
    await page.locator('#density').fill('34');
    expect(await page.locator('#styled').evaluate(grid => grid.rowHeight)).toBe(34);
    await page.locator('#reset').click();
    expect(await page.locator('#styled').evaluate(grid => grid.rowHeight)).toBe(22);
    await page.locator('#sheets').uncheck();
    expect(await page.locator('#styled').evaluate(grid => grid.additionalStyleSheets.length)).toBe(0);
    expect(errors).toEqual([]);
});

test('column ratio and region visibility support defaults, pre-upgrade assignments and base-compatible attributes', async ({ page }) => {
    await page.goto('/tests/fixture.html');
    await page.evaluate(() => {
        const grid = createGrid();
        grid.nameColumnRatio = 0.35;
        grid.showHead = false;
        grid.showDescription = false;
        const attributed = document.createElement('node-projects-property-grid');
        attributed.id = 'attributed';
        attributed.nameColumnRatio = 0.4;
        attributed.showDescription = false;
        attributed.setAttribute('name-column-ratio', '0.65suffix');
        attributed.setAttribute('show-head', 'false'); // Boolean attributes are presence-based.
        attributed.setAttribute('show-description', '');
        document.body.append(attributed);
        const defaults = document.createElement('node-projects-property-grid');
        defaults.id = 'defaults';
        document.body.append(defaults);
    });
    await page.evaluate(() => import('/dist/index.js'));
    await waitForEditors(page);
    expect(await page.locator('#grid').evaluate(g => [g.nameColumnRatio, g.showHead, g.showDescription, ...g._tree.columns.map(c => c.width)])).toEqual([0.35, false, false, 0.35, 0.65]);
    await expect(page.locator('#grid [part="header"]')).toBeHidden();
    await expect(page.locator('#grid [part="description"]')).toBeHidden();
    expect(await page.locator('#attributed').evaluate(g => [g.nameColumnRatio, g.showHead, g.showDescription])).toEqual([0.65, true, true]);
    expect(await page.locator('#defaults').evaluate(g => [g.nameColumnRatio, g.showHead, g.showDescription])).toEqual([0.5, false, true]);
    await expect(page.locator('#defaults [part="header"]')).toBeHidden();
    await expect(page.locator('#defaults [part="description"]')).toBeVisible();
    const rejected = await page.locator('#grid').evaluate(g => [0, 1, -0.1, 1.1, NaN, Infinity, '0.5', null, undefined].map(value => {
        try { g.nameColumnRatio = value; return 'accepted'; } catch (error) { return error.name; }
    }));
    expect(rejected).toEqual(Array(9).fill('RangeError'));
    expect(await page.locator('#grid').evaluate(g => g.nameColumnRatio)).toBe(0.35);
    await page.locator('#attributed').evaluate(g => g.setAttribute('name-column-ratio', '0.2'));
    expect(await page.locator('#attributed').evaluate(g => g.nameColumnRatio)).toBe(0.65);
});

test('live column weights clear drag widths and regions preserve pending editor identity and selection', async ({ page }) => {
    await load(page);
    await page.evaluate(() => createGrid());
    await waitForEditors(page);
    const grid = page.locator('#grid');
    const input = row(grid, 'title').locator('input');
    await input.fill('Uncommitted');
    await input.evaluate(e => { window.retainedInput = e; e.setSelectionRange(1, 6); });
    const before = await row(grid, 'title').locator('[part~="property-name"]').evaluate(e => e.getBoundingClientRect().width);
    await grid.evaluate(g => {
        window.retainedTree = g._tree;
        g._tree.columns.forEach(c => c.customWidthPx = 70);
        g.nameColumnRatio = 0.7;
        g.showHead = false;
        g.showDescription = false;
        g.rowHeight = 48;
    });
    expect(await row(grid, 'title').locator('[part~="property-name"]').evaluate(e => e.getBoundingClientRect().width)).toBeGreaterThan(before);
    expect(await grid.evaluate(g => ({
        sameTree: g._tree === retainedTree, sameEditor: g.shadowRoot.activeElement === retainedInput,
        selection: [retainedInput.selectionStart, retainedInput.selectionEnd], value: retainedInput.value,
        committed: g.selectedObject.title, custom: g._tree.columns.map(c => c.customWidthPx ?? null), weights: g._tree.columns.map(c => c.width)
    }))).toEqual({ sameTree: true, sameEditor: true, selection: [1, 6], value: 'Uncommitted', committed: 'Hello', custom: [null, null], weights: [0.7, 0.30000000000000004] });
    await grid.evaluate(g => { g.showHead = true; g.showDescription = true; });
    await expect(grid.locator('[part="header"]')).toBeVisible();
    await expect(grid.locator('[part="description"]')).toBeVisible();
    await expect(input).toBeFocused();
});

test('inherited row, category, separator and optional editor hooks retain state priority and fixed geometry', async ({ page }) => {
    await load(page);
    await page.evaluate(() => {
        const parent = document.createElement('section');
        parent.style.cssText = `--pg-row-background: #f1f2f4; --pg-alternate-row-background: #e2e3e4;
            --pg-category-background: #d1d2d3; --pg-category-font-weight: 600; --pg-category-name-inset: 8px;
            --pg-cell-padding-x: 6px; --pg-row-separator-style: dashed; --pg-cell-separator-style: dotted;
            --pg-row-separator-color: #112233; --pg-cell-separator-color: #445566;
            --pg-editor-height: 30px; --pg-editor-border: 2px solid #aabbcc;
            --pg-description-min-height: 40px; --pg-description-max-height: 70px; --pg-description-font-weight: 500;
            --pg-expander-size: 16px; --pg-expander-position: center;`;
        document.body.append(parent);
        const g = createGrid(parent);
        g.rowHeight = 48;
    });
    await waitForEditors(page);
    const grid = page.locator('#grid');
    await expect(row(grid, 'title')).toHaveCSS('background-color', 'rgb(241, 242, 244)');
    await expect(row(grid, 'count')).toHaveCSS('background-color', 'rgb(226, 227, 228)');
    await expect(grid.locator('[part~="category-row"]')).toHaveCSS('background-color', 'rgb(209, 210, 211)');
    await expect(grid.locator('[part~="category-row"]')).toHaveCSS('font-weight', '600');
    await expect(grid.locator('[part~="category-row"] [part~="property-name"]')).toHaveCSS('padding-left', '14px');
    await expect(grid.locator('[part~="expander"]').first()).toHaveCSS('width', '20px');
    await expect(grid.locator('[part~="expander"]').first()).toHaveCSS('background-size', '16px 16px');
    await expect(row(grid, 'count').locator('[part~="editor-number"]')).toHaveCSS('height', '30px');
    await expect(row(grid, 'enabled').locator('input')).toHaveCSS('height', '13px');
    await expect(grid.locator('[part="description"]')).toHaveCSS('min-height', '40px');
    await expect(grid.locator('[part="description"]')).toHaveCSS('max-height', '70px');
    const separator = await row(grid, 'title').evaluate(r => ({ row: getComputedStyle(r).borderBottomStyle,
        cell: getComputedStyle(r.querySelector('.wb-col')).borderRightStyle, height: r.getBoundingClientRect().height,
        cellWidth: getComputedStyle(r.querySelector('.wb-col')).borderRightWidth }));
    expect(separator).toEqual({ row: 'dashed', cell: 'dotted', height: 48, cellWidth: '1px' });
    await grid.evaluate(g => { g.style.setProperty('--pg-row-separator-style', 'none'); g.style.setProperty('--pg-cell-separator-style', 'none'); });
    await expect(row(grid, 'title')).toHaveCSS('height', '48px');
    await expect(row(grid, 'title').locator('[part~="property-name"]')).toHaveCSS('border-right-width', '1px');
    await expect(row(grid, 'title')).toHaveCSS('border-bottom-style', 'solid');
    await expect(row(grid, 'title')).toHaveCSS('border-bottom-width', '1px');
    await expect(row(grid, 'title')).toHaveCSS('border-bottom-color', 'rgba(0, 0, 0, 0)');
    await expect(row(grid, 'title').locator('[part~="property-name"]')).toHaveCSS('border-right-style', 'solid');
    await expect(row(grid, 'title').locator('[part~="property-name"]')).toHaveCSS('border-right-color', 'rgba(0, 0, 0, 0)');
    await row(grid, 'title').hover();
    await expect(row(grid, 'title')).not.toHaveCSS('background-color', 'rgb(241, 242, 244)');
    await row(grid, 'title').locator('[part~="property-name"]').click();
    await page.mouse.move(0, 0);
    await expect(row(grid, 'title')).not.toHaveCSS('background-color', 'rgb(241, 242, 244)');
});

test('virtualized stripe parity is stable and opt-in heights fit textarea, nullable and any native controls', async ({ page }) => {
    await load(page);
    await page.evaluate(() => {
        const g = createGrid();
        g.rowHeight = 48;
        g.style.cssText = '--pg-row-background: #f1f2f4; --pg-alternate-row-background: #e1e2e3; --pg-editor-height: 30px;';
        g.typeDefinitions[0].properties.push(...Array.from({ length: 150 }, (_, i) => ({ name: `tail${i}`, type: 'string' })));
        g.getSpecialEditorForType = async p => p.name === 'title' ? document.createElement('textarea') : null;
    });
    await expect(page.locator('#grid textarea')).toBeVisible();
    const grid = page.locator('#grid');
    for (const selector of ['textarea', '[part~="nullable-editor"] input[type="number"]', '[part~="any-editor"] select', '[part~="any-editor"] [part~="editor-text"]']) {
        const dimensions = await grid.locator(selector).evaluate(e => { const a = e.getBoundingClientRect(), b = e.closest('.wb-col').getBoundingClientRect(); return [a.height, a.top - b.top, b.bottom - a.bottom]; });
        expect(dimensions[0]).toBe(30);
        expect(dimensions[1]).toBeGreaterThanOrEqual(0);
        expect(dimensions[2]).toBeGreaterThanOrEqual(0);
    }
    await grid.locator('[part="tree"]').evaluate(e => e.scrollTop = 3500);
    await expect(row(grid, 'tail70').locator('input')).toBeVisible();
    expect(await grid.evaluate(g => [...g.shadowRoot.querySelectorAll('[part~="row"]')].every(r => {
        const index = parseFloat(r.style.top) / 48;
        return getComputedStyle(r).backgroundColor === (index % 2 ? 'rgb(225, 226, 227)' : 'rgb(241, 242, 244)');
    }))).toBe(true);
});

// Original pre-extension stylesheet from the approved baseline snapshot. Keep this
// independent of PropertyGrid.style: deleting new rules from the current sheet
// would let future default regressions silently redefine the expected appearance.
const originalStyle = `
    :host {
        display: block; height: 100%; width: 100%;
        --wb-font-stack: var(--pg-font-family, Helvetica, sans-serif);
        --wb-background-color: var(--pg-background, #ffffff);
        --wb-node-text-color: var(--pg-color, #56534c);
        --wb-border-color: var(--pg-border-color, #56534c);
        --wb-grid-color: var(--pg-grid-color, #dedede);
        --wb-grid-color-grayscale: var(--pg-grid-color, #dedede);
        --wb-focus-border-color: var(--pg-focus-color, #275dc5);
        --wb-hover-color: var(--pg-hover-background, rgb(247.1401574803, 251.5590551181, 253.6598425197));
        --wb-active-color: var(--pg-selected-background, #e5f3fb);
        --wb-active-border-color: var(--pg-selected-border-color, #70c0e7);
        --wb-active-hover-color: var(--pg-selected-hover-background, #dceff8);
        --wb-active-hover-border-color: var(--pg-selected-hover-border-color, #26a0da);
        --wb-active-color-grayscale: var(--pg-selected-background, #f0f0f0);
        --wb-active-border-color-grayscale: var(--pg-selected-border-color, rgb(171.5, 171.5, 171.5));
        --wb-active-hover-color-grayscale: var(--pg-selected-hover-background, #eaeaea);
        --wb-active-column-color: var(--pg-selected-background, rgb(247.1401574803, 251.5590551181, 253.6598425197));
        --wb-active-cell-color: var(--pg-selected-background, rgb(125.1417322835, 198.1496062992, 232.8582677165));
        --wb-active-cell-color-grayscale: var(--pg-selected-background, #b3b3b3);
    }
    * { box-sizing: border-box; }
    #tableDiv { background: var(--pg-background, transparent); color: var(--pg-color, inherit);
        font-family: var(--pg-font-family, inherit); font-size: var(--pg-font-size, inherit);
        height: 100%; display: grid; overflow: auto; grid-template-rows: auto 1fr auto auto;
        grid-template-areas: 'head' 'properties' '.' 'description'; }
    .input-group { display: flex; align-items: center; }
    .form-control { width: 100%; box-sizing: border-box; min-height: unset; height: 21px; }
    #clear { height: 11px; }
    #head { border-bottom: var(--pg-header-border, 1px lightgray solid); grid-area: head;
        color: var(--pg-header-color, inherit); font-size: var(--pg-header-font-size, 10pt);
        font-weight: var(--pg-header-font-weight, inherit); overflow: hidden; }
    thead th, #head { position: sticky; top: 0; left: 1px;
        background: var(--pg-header-background, #f0f0f0); padding: var(--pg-header-padding, 0 0 0 5px); }
    #tableInnerDiv { overflow: auto; width: 100%; height: 100%; grid-area: properties; }
    #table { font-size: var(--pg-font-size, 14px); border: var(--pg-tree-border, 2px solid var(--wb-border-color));
        border-radius: var(--pg-tree-radius, 4px); user-select: none; overflow: auto;
        width: calc(100% - 1px); table-layout: fixed; }
    #table:focus, #table:focus-within { border-color: var(--wb-focus-border-color); }
    #lastCol { width: 100%; }
    #description { font-family: var(--pg-description-font-family, var(--pg-font-family, tahoma, arial, helvetica));
        font-size: var(--pg-description-font-size, 10pt); padding: var(--pg-description-padding, 5px);
        grid-area: description; background-color: var(--pg-description-background, #e6e6e6);
        color: var(--pg-description-color, inherit); border-top: var(--pg-description-border, none); }
    #descTitel { margin: var(--pg-description-title-margin, 1.33em 0); font-weight: var(--pg-description-title-font-weight, bold); }
    #descText { margin: var(--pg-description-text-margin, 1em 0); white-space: break-spaces; }
    div.wunderbaum.wb-grid div.wb-node-list div.wb-row:hover:not(.wb-active):not(.wb-selected) {
        border-color: var(--pg-hover-border-color, transparent); border-bottom-color: var(--pg-hover-border-color, var(--wb-grid-color)); }
    div.wunderbaum.wb-grid div.wb-node-list div.wb-row.wb-focus:hover:not(.wb-active):not(.wb-selected) {
        border-color: var(--pg-hover-border-color, var(--wb-active-border-color)); border-bottom-color: var(--pg-hover-border-color, var(--wb-grid-color)); }
    @layer property-grid-editors {
        :where(input[part~="editor"], select[part~="editor"], textarea[part~="editor"], button[part~="editor"]) {
            background: var(--pg-editor-background, revert); color: var(--pg-editor-color, revert);
            border: var(--pg-editor-border, revert); border-radius: var(--pg-editor-radius, revert);
            padding: var(--pg-editor-padding, revert); font-family: var(--pg-editor-font-family, var(--pg-font-family, revert));
            font-size: var(--pg-editor-font-size, revert); accent-color: var(--pg-editor-accent-color, auto); }
        :where([part~="editor"]:focus-visible) { outline-color: var(--pg-editor-focus-color, var(--pg-focus-color, revert)); }
    }
    div.wunderbaum.wb-grid div.wb-node-list div.wb-row span.wb-col input.wb-input-edit:where([part~="editor"]),
    div.wunderbaum.wb-grid div.wb-node-list div.wb-row span.wb-col > select:where([part~="editor"]),
    div.wunderbaum.wb-grid div.wb-node-list div.wb-row span.wb-col > :is(input[type="color"], input[type="date"],
        input[type="datetime"], input[type="datetime-local"], input[type="email"], input[type="month"], input[type="number"],
        input[type="password"], input[type="search"], input[type="tel"], input[type="text"], input[type="time"],
        input[type="url"], input[type="week"]):where([part~="editor"]) { border: var(--pg-editor-border, none); }
    div.wunderbaum.wb-grid div.wb-node-list div.wb-row span.wb-col > :is(input, select):where([part~="editor"]):focus {
        border: var(--pg-editor-focus-border, 1px dashed #70c0e7); }
    textarea { resize: none; }
    div.wunderbaum span.wb-node i.wb-expander { background-size: var(--pg-expander-size, 12px) var(--pg-expander-size, 12px);
        background-position: var(--pg-expander-position, 3px 3px); filter: var(--pg-expander-filter, none); opacity: var(--pg-expander-opacity, 1); }
`;

async function appearance(grid) {
    return grid.evaluate(g => {
        const host = g.getBoundingClientRect();
        const properties = ['height', 'max-height', 'min-width', 'align-items', 'align-self', 'background-color', 'background-image',
            'border-top', 'border-right', 'border-bottom', 'border-left', 'border-image-source', 'font', 'padding', 'border-radius', 'outline-style', 'outline-width'];
        return [...g.shadowRoot.querySelectorAll('#tableDiv, #head, #tableInnerDiv, #table, #description, .wb-row, .wb-col, [part~="editor"]')].map(e => {
            const rect = e.getBoundingClientRect(), style = getComputedStyle(e);
            return { tag: e.localName, part: e.getAttribute('part'), bounds: [rect.x - host.x, rect.y - host.y, rect.width, rect.height],
                styles: properties.map(p => style.getPropertyValue(p)), pseudo: getComputedStyle(e, '::after').content };
        });
    });
}

async function adoptOriginal(grid, sample = false) {
    await grid.evaluate((g, { originalStyle, sample }) => {
        const sheet = new CSSStyleSheet();
        // Compare historical appearance except for the intentional centering/any-layout fixes.
        sheet.replaceSync(`${originalStyle}\n@layer property-grid-editors {
            :where([part~="property-value"], [part~="editor-wrapper"]) { align-items: center; }
            :where([part~="any-editor"]) { gap: 4px; min-width: 0; }
            :where([part~="any-type-selector"]) { flex-shrink: 0; }
            :where([part~="any-editor"] > input:not([type="checkbox"])) { flex: 1; min-width: 0; }
        }`);
        const sheets = [g.shadowRoot.adoptedStyleSheets[0], sheet];
        if (sample) {
            const editor = new CSSStyleSheet();
            editor.replaceSync(`.sample-editor input {
                background: var(--pg-editor-background, revert); color: var(--pg-editor-color, revert);
                border: var(--pg-editor-border, revert); border-radius: var(--pg-editor-radius, revert);
                padding: var(--pg-editor-padding, revert); font-family: var(--pg-editor-font-family, var(--pg-font-family, revert));
                font-size: var(--pg-editor-font-size, revert); accent-color: var(--pg-editor-accent-color, auto);
                outline-color: var(--pg-editor-focus-color, var(--pg-focus-color, revert)); }`);
            sheets.push(editor);
        } else sheets.push(...g.additionalStyleSheets);
        g.shadowRoot.adoptedStyleSheets = sheets;
    }, { originalStyle, sample });
}

for (const height of [22, 28]) {
    test(`original default and class-authored appearance matches actual rectangles at ${height}px`, async ({ page }) => {
        await load(page);
        await page.evaluate(height => {
            const g = createGrid(); g.rowHeight = height;
            g.typeDefinitions[0].properties.push(...['native', 'wrapped', 'checkbox', 'radio', 'area', 'button'].map(name => ({ name, type: 'string' })));
            g.getSpecialEditorForType = async p => {
                if (!['native', 'wrapped', 'checkbox', 'radio', 'area', 'button'].includes(p.name)) return null;
                const e = document.createElement(p.name === 'area' ? 'textarea' : p.name === 'button' ? 'button' : 'input');
                e.className = 'legacy-control form-control';
                if (['checkbox', 'radio'].includes(p.name)) e.type = p.name;
                if (p.name !== 'wrapped') return e;
                const wrapper = document.createElement('div'); wrapper.className = 'form-control'; wrapper.append(e); return wrapper;
            };
            const sheet = new CSSStyleSheet();
            sheet.replaceSync(`.wb-row { background-color: rgb(11, 22, 33); background-image: linear-gradient(red, blue); }
                .legacy-control { min-width: 72px; height: 31px; max-height: none; padding: 3px; }
                .wb-col.wb-invalid { border: 2px dotted purple; }`);
            g.additionalStyleSheets = [sheet];
        }, height);
        const grid = page.locator('#grid');
        await expect(row(grid, 'wrapped').locator('input')).toBeVisible();
        await row(grid, 'count').locator('[part~="property-value"]').evaluate(e => e.classList.add('wb-invalid'));
        const current = await appearance(grid);
        await adoptOriginal(grid);
        expect(current).toEqual(await appearance(grid));
        await page.evaluate(height => { const g = createGrid(document.body, 'unthemed'); g.rowHeight = height; }, height);
        const unthemed = page.locator('#unthemed'); await waitForEditors(page, 'unthemed');
        const native = await appearance(unthemed); await adoptOriginal(unthemed);
        expect(native).toEqual(await appearance(unthemed));
    });

    test(`original dark sample native and custom geometry matches at ${height}px`, async ({ page }) => {
        await page.goto('/sample/themed.html');
        const grid = page.locator('#styled');
        await expect(grid.locator('.sample-editor input')).toBeVisible();
        await grid.evaluate((g, height) => { g.rowHeight = height; g._tree.root.expandAll(true); }, height);
        await expect(row(grid, 'extra').locator('[part~="editor-text"]')).toBeVisible();
        const current = await appearance(grid);
        await adoptOriginal(grid, true);
        expect(current).toEqual(await appearance(grid));
    });
}

test('row author colors, images, borders, parts and validation paint survive missing and explicit separator hooks', async ({ page }) => {
    await load(page);
    await page.evaluate(() => {
        const g = createGrid();
        const sheet = new CSSStyleSheet();
        sheet.replaceSync(`.wb-row { background-color: rgb(12, 23, 34); background-image: linear-gradient(red, blue); }
            .wb-col.wb-invalid { border: 1px dotted rgb(181, 55, 59); }
            div.wunderbaum.wb-grid div.wb-node-list div.wb-row span.wb-col.consumer-border { border-right: 3px double purple; }
            div.wunderbaum.wb-grid div.wb-node-list div.wb-row.consumer-border { border-bottom: 3px double purple; }`);
        g.additionalStyleSheets = [sheet];
        const part = document.createElement('style'); part.textContent = '#grid::part(property-name) { border-left: 2px dashed green; }'; document.head.append(part);
    });
    const grid = page.locator('#grid'); await waitForEditors(page);
    const title = row(grid, 'title'), cell = title.locator('[part~="property-value"]');
    await title.evaluate(e => e.classList.add('consumer-border'));
    await cell.evaluate(e => e.classList.add('consumer-border', 'wb-invalid'));
    await expect(title).toHaveCSS('background-color', 'rgb(12, 23, 34)');
    await expect(title).toHaveCSS('background-image', /linear-gradient/);
    await expect(title).toHaveCSS('border-bottom', '3px double rgb(128, 0, 128)');
    await expect(cell).toHaveCSS('border-top', '1px dotted rgb(181, 55, 59)');
    await expect(cell).toHaveCSS('border-right', '3px double rgb(128, 0, 128)');
    await expect(title.locator('[part~="property-name"]')).toHaveCSS('border-left', '2px dashed rgb(0, 128, 0)');
    await grid.evaluate(g => g.style.cssText = '--pg-row-background: yellow; --pg-row-separator-style: dashed; --pg-cell-separator-style: dotted;');
    await expect(title).toHaveCSS('background-color', 'rgb(12, 23, 34)');
    await expect(title).toHaveCSS('background-image', /linear-gradient/);
    await expect(cell).toHaveCSS('border-top', '1px dotted rgb(181, 55, 59)');
    await expect(cell).toHaveCSS('border-right', '3px double rgb(128, 0, 128)');
    for (const e of [title, cell]) {
        await expect(e).toHaveCSS('border-image-source', 'none');
        expect(await e.evaluate(e => getComputedStyle(e, '::after').content)).toBe('none');
    }
    await grid.evaluate(g => {
        g.style.setProperty('--pg-row-separator-style', 'none');
        g.style.setProperty('--pg-cell-separator-style', 'none');
    });
    await expect(title).toHaveCSS('border-bottom', '3px double rgb(128, 0, 128)');
    await expect(cell).toHaveCSS('border-top', '1px dotted rgb(181, 55, 59)');
    await expect(cell).toHaveCSS('border-right', '3px double rgb(128, 0, 128)');
    await expect(title.locator('[part~="property-name"]')).toHaveCSS('border-left', '2px dashed rgb(0, 128, 0)');
    // Remove the ordinary background rule, then check renderer-owned status images.
    await grid.evaluate(g => g.additionalStyleSheets = []);
    await title.evaluate(e => { e.classList.remove('consumer-border'); e.classList.add('wb-busy', 'wb-status-error'); });
    await expect(title).toHaveCSS('background-image', /repeating-linear-gradient/);
    await expect(title).toHaveCSS('color', 'rgb(181, 55, 59)');
    await title.hover();
    await expect(title).toHaveCSS('background-image', /repeating-linear-gradient/);
    await expect(title).not.toHaveCSS('background-color', 'rgb(255, 255, 0)');
});

test('color-only inherited separator queries paint native borders and leave feedback and part borders visible', async ({ page }) => {
    await load(page);
    await page.evaluate(() => {
        const parent = document.createElement('section');
        parent.style.cssText = '--pg-row-separator-color: #112233; --pg-cell-separator-color: #445566;';
        document.body.append(parent); createGrid(parent);
        const sheet = document.createElement('style');
        sheet.textContent = '#grid::part(property-name) { border-right: 2px double purple; }'; document.head.append(sheet);
    });
    const grid = page.locator('#grid'); await waitForEditors(page);
    const title = row(grid, 'title'), cell = title.locator('[part~="property-value"]');
    await expect(title).toHaveCSS('border-bottom', '1px solid rgb(17, 34, 51)');
    await expect(cell).toHaveCSS('border-right', '1px solid rgb(68, 85, 102)');
    await expect(title.locator('[part~="property-name"]')).toHaveCSS('border-right', '2px double rgb(128, 0, 128)');
    await grid.evaluate(g => {
        g.style.setProperty('--pg-row-separator-style', 'none'); g.style.setProperty('--pg-cell-separator-style', 'none');
    });
    await expect(title).toHaveCSS('border-bottom', '1px solid rgba(0, 0, 0, 0)');
    await expect(cell).toHaveCSS('border-right', '1px solid rgba(0, 0, 0, 0)');
    await expect(title.locator('[part~="property-name"]')).toHaveCSS('border-right', '2px double rgb(128, 0, 128)');
    await title.evaluate(e => { e.classList.add('wb-error'); e.style.borderBottom = '2px dotted red'; });
    await cell.evaluate(e => e.classList.add('wb-invalid'));
    await expect(title).toHaveCSS('border-bottom', '2px dotted rgb(255, 0, 0)');
    await expect(cell).toHaveCSS('border-top', '1px dotted rgb(181, 55, 59)');
    await expect(cell).toHaveCSS('border-image-source', 'none');
});

test('editors and nullable/any wrappers center vertically without a height token', async ({ page }) => {
    await load(page);
    await page.evaluate(() => {
        const grid = createGrid();
        grid.typeDefinitions[0].properties.push({ name: 'items', type: 'array', collection: { item: { type: 'string' } } },
            { name: 'radio', type: 'string' });
        grid.getSpecialEditorForType = async property => {
            if (property.name !== 'radio') return null;
            const input = document.createElement('input'); input.type = 'radio'; return input;
        };
    });
    const grid = page.locator('#grid'); await waitForEditors(page);
    await expect(row(grid, 'radio').locator('input')).toBeVisible();
    for (const height of [22, 48]) {
        await grid.evaluate((g, height) => g.rowHeight = height, height);
        for (const name of ['title', 'count', 'enabled', 'mode', 'extra', 'items', 'radio']) {
            const cell = row(grid, name).locator('[part~="property-value"]');
            await expect(cell).toHaveCSS('align-items', 'center');
            const offsets = await cell.evaluate(cell => [...cell.querySelectorAll('[part~="editor"]')]
                .filter(e => e.getBoundingClientRect().height && e.matches('input, select, button'))
                .map(e => {
                    const rect = e.getBoundingClientRect(), parent = e.parentElement.getBoundingClientRect();
                    const style = getComputedStyle(e);
                    return rect.top + rect.height / 2 - parent.top - parent.height / 2 -
                        (parseFloat(style.marginTop) - parseFloat(style.marginBottom)) / 2;
                }));
            for (const offset of offsets) expect(Math.abs(offset), `${height}px ${name}`).toBeLessThanOrEqual(0.6);
        }
    }
    await grid.evaluate(g => {
        const sheet = new CSSStyleSheet();
        sheet.replaceSync('[part~="property-value"], [part~="editor-wrapper"] { align-items: flex-start; }');
        g.additionalStyleSheets = [sheet];
    });
    await expect(row(grid, 'title').locator('[part~="property-value"]')).toHaveCSS('align-items', /^(flex|flow)-start$/);
    await expect(row(grid, 'count').locator('[part~="editor-wrapper"]')).toHaveCSS('align-items', /^(flex|flow)-start$/);
});

test('inherited inline padding overrides the shorthand without changing block padding or author rules', async ({ page }) => {
    await load(page);
    await page.evaluate(() => {
        const host = document.createElement('section');
        host.style.cssText = '--pg-editor-padding: 1px 3px; --pg-editor-padding-inline: 9px 7px';
        document.body.append(host); createGrid(host); createGrid(document.body, 'plain');
    });
    const grid = page.locator('#grid'); await waitForEditors(page); await waitForEditors(page, 'plain');
    for (const name of ['title', 'count', 'mode', 'extra']) {
        for (const editor of await row(grid, name).locator('input:not([type="checkbox"]), select').all()) {
            if (!await editor.isVisible()) continue;
            await expect(editor).toHaveCSS('padding-top', '1px');
            await expect(editor).toHaveCSS('padding-bottom', '1px');
            await expect(editor).toHaveCSS('padding-left', '9px');
            await expect(editor).toHaveCSS('padding-right', '7px');
        }
    }
    await expect(row(page.locator('#plain'), 'title').locator('input')).not.toHaveCSS('padding-left', '9px');
    await grid.evaluate(g => g.parentElement.style.removeProperty('--pg-editor-padding-inline'));
    await expect(row(grid, 'title').locator('input')).toHaveCSS('padding', '1px 3px');
    await grid.evaluate(g => {
        g.parentElement.style.setProperty('--pg-editor-padding-inline', '12px');
        const sheet = new CSSStyleSheet(); sheet.replaceSync('input { padding: 2px 5px; }'); g.additionalStyleSheets = [sheet];
    });
    await expect(row(grid, 'title').locator('input')).toHaveCSS('padding', '2px 5px');
});

test('expanders stay vertically centered and toggle at tall row heights with and without indentation', async ({ page }) => {
    await load(page);
    await page.evaluate(() => createGrid());
    const grid = page.locator('#grid'); await waitForEditors(page);
    const expander = row(grid, 'nested').locator('[part~="expander"]');
    for (const indent of [null, '12px']) {
        await grid.evaluate((g, indent) => {
            if (indent === null) g.style.removeProperty('--pg-indent');
            else g.style.setProperty('--pg-indent', indent);
        }, indent);
        for (const height of [22, 28, 48, 64]) {
            await grid.evaluate((g, height) => g.rowHeight = height, height);
            const offset = await expander.evaluate(e => {
                const icon = e.getBoundingClientRect(), cell = e.parentElement.getBoundingClientRect();
                return icon.top + icon.height / 2 - cell.top - cell.height / 2;
            });
            expect(offset, `${height}px row, indent=${indent}`).toBeCloseTo(0, 1);
            await expect(expander).toHaveCSS('background-image', /expanderClose\.svg/);
            await expander.click();
            await expect(row(grid, 'child')).toHaveCount(0);
            await expect(expander).toHaveCSS('background-image', /expander\.svg/);
            await expander.click();
            await expect(row(grid, 'child').locator('input')).toBeVisible();
        }
    }
});

test('hierarchy indent changes per depth with live label widths and fixed expander slots', async ({ page }) => {
    await load(page);
    await page.evaluate(() => {
        const host = document.createElement('section'); document.body.append(host);
        const grid = createGrid(host);
        grid.typeDefinitions[1].properties.push({ name: 'deeper', type: 'Deep' });
        grid.typeDefinitions.push({ name: 'Deep', properties: [{ name: 'longPropertyNameForTruncation', type: 'string' }] });
    });
    const grid = page.locator('#grid'); await waitForEditors(page);
    const leaf = row(grid, 'longPropertyNameForTruncation'), cell = leaf.locator('[part~="property-name"]');
    await expect(leaf.locator('input')).toBeVisible();
    const native = await cell.locator('.wb-title').boundingBox();
    for (const indent of [0, 12, 32]) {
        await grid.evaluate((g, indent) => g.parentElement.style.setProperty('--pg-indent', `${indent}px`), indent);
        const indents = cell.locator('.wb-indent:not(.wb-expander)');
        await expect(indents).toHaveCount(2);
        for (const slot of await indents.all()) await expect(slot).toHaveCSS('width', `${indent}px`);
        await expect(cell.locator('.wb-expander')).toHaveCSS('width', '20px');
        const bounds = await cell.evaluate(cell => {
            const rect = cell.getBoundingClientRect(), title = cell.querySelector('.wb-title').getBoundingClientRect();
            return { inset: title.left - rect.left, right: rect.right - title.right, width: title.width };
        });
        expect(bounds.inset).toBeCloseTo(2 + 20 + 2 * indent, 1);
        expect(bounds.right).toBeCloseTo(3, 1);
        expect(bounds.width).toBeGreaterThan(0);
        await grid.evaluate(g => g.nameColumnRatio = 0.65);
        const wider = await cell.locator('.wb-title').boundingBox();
        expect(wider.width).toBeGreaterThan(bounds.width);
        await grid.evaluate(g => g.nameColumnRatio = 0.5);
    }
    await grid.evaluate(g => g.parentElement.style.removeProperty('--pg-indent'));
    await expect(cell).toHaveCSS('display', 'block');
    expect((await cell.locator('.wb-title').boundingBox()).width).toBeCloseTo(native.width, 1);
});

test('optional native heights exclude form-control checkboxes, radios and wrapper roots and respect class sizing', async ({ page }) => {
    await load(page);
    await page.evaluate(() => {
        const g = createGrid(); g.rowHeight = 48;
        g.typeDefinitions = [{ name: 'Example', properties: ['text', 'checkbox', 'radio', 'wrapper', 'native', 'area', 'button', 'author'].map(name => ({ name, type: 'string' })) }];
        g.getSpecialEditorForType = async p => {
            const e = document.createElement(p.name === 'area' ? 'textarea' : p.name === 'button' ? 'button' : 'input');
            if (['checkbox', 'radio'].includes(p.name)) e.type = p.name;
            if (p.name !== 'native') e.className = p.name === 'author' ? 'author' : 'form-control';
            if (p.name !== 'wrapper') return e;
            const root = document.createElement('div'); root.className = 'form-control'; root.append(e); return root;
        };
        const sheet = new CSSStyleSheet(); sheet.replaceSync('.author { height: 17px; min-width: 41px; max-height: none; }'); g.additionalStyleSheets = [sheet];
    });
    const grid = page.locator('#grid'); await waitForEditors(page);
    const shape = await grid.locator('[part~="editor-checkbox"], [part~="editor-radio"], div.form-control').evaluateAll(es => es.map(e => e.getBoundingClientRect().height));
    await grid.evaluate(g => g.style.setProperty('--pg-editor-height', '30px'));
    expect(await grid.locator('[part~="editor-checkbox"], [part~="editor-radio"], div.form-control').evaluateAll(es => es.map(e => e.getBoundingClientRect().height))).toEqual(shape);
    expect(shape).toEqual([21, 21, 21]);
    for (const name of ['text', 'native', 'area', 'button']) await expect(row(grid, name).locator('[part~="editor"]').first()).toHaveCSS('height', '30px');
    await expect(grid.locator('.author')).toHaveCSS('height', '17px');
    await expect(grid.locator('.author')).toHaveCSS('min-width', '41px');
    await grid.evaluate(g => g.style.setProperty('--pg-editor-height', '80px'));
    for (const name of ['text', 'native', 'area', 'button']) await expect(row(grid, name).locator('[part~="editor"]').first()).toHaveCSS('height', '46px');
    await grid.evaluate(g => g.style.removeProperty('--pg-editor-height'));
    await expect(row(grid, 'text').locator('input')).toHaveCSS('height', '21px');
    await expect(row(grid, 'area').locator('textarea')).toHaveCSS('max-height', 'none');
});

test('nested nullable, any and custom focus borders opt in without unthemed fallback or checkbox changes', async ({ page }) => {
    await load(page);
    await page.evaluate(() => {
        const g = createGrid();
        g.getSpecialEditorForType = async p => {
            if (p.name !== 'title') return null;
            const root = document.createElement('div'); root.innerHTML = '<input><select><option>a</option></select><input type="checkbox">'; return root;
        };
    });
    const grid = page.locator('#grid'); await waitForEditors(page);
    const controls = [row(grid, 'title').locator('input').first(), row(grid, 'title').locator('select'),
        row(grid, 'count').locator('input[type="number"]'), row(grid, 'extra').locator('[part~="editor-text"]'), row(grid, 'extra').locator('select')];
    for (const control of controls) {
        const border = await control.evaluate(e => getComputedStyle(e).borderTop);
        await control.focus(); await expect(control).toHaveCSS('border-top', border);
        await grid.evaluate(g => g.style.setProperty('--pg-editor-focus-border', '2px dotted rgb(10, 20, 30)'));
        await expect(control).toHaveCSS('border-top', '2px dotted rgb(10, 20, 30)');
        await control.evaluate(e => e.blur()); await expect(control).toHaveCSS('border-top', border);
        await grid.evaluate(g => g.style.removeProperty('--pg-editor-focus-border'));
    }
    const checkbox = row(grid, 'title').locator('input[type="checkbox"]');
    const border = await checkbox.evaluate(e => getComputedStyle(e).borderTop);
    await grid.evaluate(g => g.style.setProperty('--pg-editor-focus-border', '2px dotted red'));
    await checkbox.focus(); await expect(checkbox).toHaveCSS('border-top', border);
});

test('ratio and density resize retain row/cell feedback through the observer without losing pending edits', async ({ page }) => {
    await load(page); await page.evaluate(() => createGrid()); await waitForEditors(page);
    const grid = page.locator('#grid');
    await row(grid, 'title').locator('input').evaluate(e => { window.feedbackInput = e; e.focus(); e.value = 'Pending'; e.setSelectionRange(1, 4); });
    await grid.evaluate(g => {
        const row = feedbackInput.closest('.wb-row'), cell = feedbackInput.closest('.wb-col');
        row.classList.add('wb-invalid', 'wb-error', 'wb-busy'); cell.classList.add('wb-invalid', 'wb-error', 'wb-busy');
        window.feedbackRow = row; window.feedbackCell = cell;
        g.nameColumnRatio = 0.7; g.rowHeight = 28;
    });
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(resolve)))));
    expect(await grid.evaluate(g => ({ row: ['wb-invalid', 'wb-error', 'wb-busy'].every(c => feedbackRow.classList.contains(c)),
        cell: ['wb-invalid', 'wb-error', 'wb-busy'].every(c => feedbackCell.classList.contains(c)),
        same: g.shadowRoot.activeElement === feedbackInput, pending: feedbackInput.value,
        selection: [feedbackInput.selectionStart, feedbackInput.selectionEnd], committed: g.selectedObject.title })))
        .toEqual({ row: true, cell: true, same: true, pending: 'Pending', selection: [1, 4], committed: 'Hello' });
    await expect(page.locator('#grid [part~="property-value"]').first()).toHaveCSS('border-top-style', 'dotted');
});

test('real asynchronous validation success and external feedback clears survive subsequent resize delivery', async ({ page }) => {
    await load(page); await page.evaluate(() => createGrid()); await waitForEditors(page);
    const grid = page.locator('#grid');
    await row(grid, 'title').locator('input').evaluate(e => { window.validationInput = e; e.focus(); e.value = 'Pending'; e.setSelectionRange(1, 4); });
    await grid.evaluate(g => {
        window.validationCell = validationInput.closest('.wb-col');
        window.validationCalls = 0;
        // Use the installed edit extension's actual delegated change/async validation path.
        g._tree.setOption('change', e => {
            validationCalls++;
            return new Promise(resolve => { window.resolveValidation = resolve; }).then(() => {
                validationCell.classList.remove('wb-invalid', 'wb-error');
                e.inputElem.setCustomValidity('');
            });
        });
        validationInput.dispatchEvent(new Event('change', { bubbles: true }));
        validationCell.classList.add('wb-invalid', 'wb-error');
        g.nameColumnRatio = 0.7;
        g.rowHeight = 28;
        // Resolve after the synchronous resize but before browser ResizeObserver delivery.
        resolveValidation();
    });
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(resolve)))));
    expect(await grid.evaluate(g => ({ calls: validationCalls,
        classes: ['wb-invalid', 'wb-error', 'wb-busy'].filter(c => validationCell.classList.contains(c)),
        same: g.shadowRoot.activeElement === validationInput, pending: validationInput.value,
        selection: [validationInput.selectionStart, validationInput.selectionEnd], committed: g.selectedObject.title })))
        .toEqual({ calls: 1, classes: [], same: true, pending: 'Pending', selection: [1, 4], committed: 'Hello' });
    await grid.evaluate(g => {
        for (const e of [validationCell, validationInput.closest('.wb-row')]) e.classList.add('wb-invalid', 'wb-error', 'wb-busy', 'wb-status-error');
        g.rowHeight = 34;
        for (const e of [validationCell, validationInput.closest('.wb-row')]) e.classList.remove('wb-invalid', 'wb-error', 'wb-busy', 'wb-status-error');
    });
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(resolve)))));
    expect(await grid.evaluate(() => [validationCell, validationInput.closest('.wb-row')].every(e =>
        !['wb-invalid', 'wb-error', 'wb-busy', 'wb-status-error'].some(c => e.classList.contains(c))))).toBe(true);
});

test('Wunderbaum async validation failure, pending retry and success remain authoritative across actual ResizeObserver passes', async ({ page }) => {
    await load(page); await page.evaluate(() => createGrid()); await waitForEditors(page);
    const grid = page.locator('#grid');
    await row(grid, 'title').locator('input').evaluate(e => { window.validatedEditor = e; e.focus(); e.value = 'Pending validation'; e.setSelectionRange(2, 6); });
    await grid.evaluate(g => {
        window.validatedCell = validatedEditor.closest('.wb-col');
        window.validationAttempts = 0;
        g._tree.setOption('change', e => {
            validationAttempts++;
            return new Promise((resolve, reject) => {
                window.finishValidation = valid => valid ? resolve() : reject(new e.util.ValidationError('Try again'));
            });
        });
        validatedEditor.dispatchEvent(new Event('change', { bubbles: true }));
        // This is a native browser observer, not a mock of the library callback.
        window.observedResizes = 0;
        window.validationResizeObserver = new ResizeObserver(() => observedResizes++);
        validationResizeObserver.observe(g._table);
    });
    await expect.poll(() => page.evaluate(() => observedResizes)).toBeGreaterThan(0);
    await grid.evaluate(g => { observedResizes = 0; g.style.width = '500px'; });
    await expect.poll(() => page.evaluate(() => observedResizes)).toBeGreaterThan(0);
    await expect(row(grid, 'title').locator('[part~="property-value"]')).toHaveClass(/wb-busy/);
    await page.evaluate(() => finishValidation(false));
    await expect(row(grid, 'title').locator('[part~="property-value"]')).toHaveClass(/wb-invalid/);
    await expect(row(grid, 'title').locator('[part~="property-value"]')).not.toHaveClass(/wb-busy/);
    await grid.evaluate(g => { observedResizes = 0; g.style.width = '460px'; });
    await expect.poll(() => page.evaluate(() => observedResizes)).toBeGreaterThan(0);
    await expect(row(grid, 'title').locator('[part~="property-value"]')).toHaveClass(/wb-invalid/);
    await grid.evaluate(g => {
        // The plugin itself clears the previous failure before starting this retry.
        validatedEditor.dispatchEvent(new Event('change', { bubbles: true }));
        g.nameColumnRatio = 0.65;
        g.rowHeight = 28;
        finishValidation(true);
    });
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(resolve)))));
    expect(await grid.evaluate(g => ({ attempts: validationAttempts, valid: validatedEditor.checkValidity(),
        feedback: ['wb-invalid', 'wb-error', 'wb-busy'].filter(c => validatedCell.classList.contains(c)),
        same: g.shadowRoot.activeElement === validatedEditor && g._table.contains(validatedEditor),
        value: validatedEditor.value, selection: [validatedEditor.selectionStart, validatedEditor.selectionEnd], committed: g.selectedObject.title })))
        .toEqual({ attempts: 2, valid: true, feedback: [], same: true, value: 'Pending validation', selection: [2, 6], committed: 'Hello' });
    await page.evaluate(() => validationResizeObserver.disconnect());
});

test('showing tall regions keeps a focused bottom-of-viewport editor rendered in a 150-row grid', async ({ page }) => {
    await load(page);
    await page.evaluate(() => {
        const g = createGrid(); g.showHead = false; g.showDescription = false;
        g.style.cssText = '--pg-header-padding: 20px; --pg-description-min-height: 200px; --pg-description-max-height: 200px;';
        g.typeDefinitions = [{ name: 'Example', properties: Array.from({ length: 150 }, (_, i) => ({ name: `field${i}`, type: 'string' })) }];
        g.selectedObject = Object.fromEntries(Array.from({ length: 150 }, (_, i) => [`field${i}`, `Value ${i}`]));
        window.regionChanges = []; g.propertyChanged.on(e => regionChanges.push(e));
    });
    const grid = page.locator('#grid'); await waitForEditors(page);
    await grid.locator('[part="tree"]').evaluate(e => e.scrollTop = 1100);
    await expect(row(grid, 'field60').locator('input')).toBeVisible();
    await grid.evaluate(g => {
        const table = g.shadowRoot.querySelector('#table'), bounds = table.getBoundingClientRect();
        const inputs = [...table.querySelectorAll('input')].filter(e => e.getBoundingClientRect().bottom <= bounds.bottom - 4);
        const e = inputs.at(-1); e.focus(); e.value = 'Uncommitted bottom'; e.setSelectionRange(2, 9);
        window.regionRetained = { e, row: e.closest('.wb-row'), key: e.closest('.wb-row').querySelector('.wb-title').textContent,
            height: table.clientHeight, top: table.scrollTop }; regionChanges.length = 0;
        g.showDescription = true; g.showHead = true;
    });
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(resolve)))));
    expect(await grid.evaluate(g => {
        const { e, row, key, height, top } = regionRetained, table = g.shadowRoot.querySelector('#table');
        const a = e.getBoundingClientRect(), b = table.getBoundingClientRect();
        return { same: g.shadowRoot.activeElement === e && g._table.contains(row) && row.contains(e),
            selection: [e.selectionStart, e.selectionEnd], value: e.value, committed: g.selectedObject[key], changes: regionChanges,
            shrunk: table.clientHeight < height, scrolled: table.scrollTop > top,
            visible: a.top >= b.top && a.bottom <= b.bottom, scrollable: table.scrollHeight > table.clientHeight };
    })).toEqual({ same: true, selection: [2, 9], value: 'Uncommitted bottom', committed: expect.stringMatching(/^Value /), changes: [],
        shrunk: true, scrolled: true, visible: true, scrollable: true });
});

test('density increase near the end expands the scroll extent before preserving the focused row', async ({ page }) => {
    await load(page);
    await page.evaluate(() => {
        const g = createGrid(); g.showDescription = false;
        g.typeDefinitions = [{ name: 'Example', properties: Array.from({ length: 150 }, (_, i) => ({ name: `field${i}`, type: 'string' })) }];
        g.selectedObject = { field145: 'Original' };
    });
    const grid = page.locator('#grid'); await waitForEditors(page);
    await grid.locator('[part="tree"]').evaluate(e => e.scrollTop = 3200);
    await expect(row(grid, 'field145').locator('input')).toBeVisible();
    await row(grid, 'field145').locator('input').evaluate(e => { window.deepEditor = e; e.focus(); e.value = 'Pending'; e.setSelectionRange(1, 3); });
    await grid.evaluate(g => g.rowHeight = 48);
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(resolve)))));
    expect(await grid.evaluate(g => ({ same: g.shadowRoot.activeElement === deepEditor && g._table.contains(deepEditor),
        value: deepEditor.value, selection: [deepEditor.selectionStart, deepEditor.selectionEnd], committed: g.selectedObject.field145,
        scroll: g._table.scrollTop > 6000 }))).toEqual({ same: true, value: 'Pending', selection: [1, 3], committed: 'Original', scroll: true });
});
