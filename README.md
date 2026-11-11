# propertygrid.webcomponent

A Shadow DOM property grid built on Wunderbaum. Built-in editors support strings,
numbers, booleans, colors, enums, nullable values, `any`, lists and dictionaries. Type definitions
can resolve asynchronously; nested types and categories form expandable rows.

```js
import '@node-projects/propertygrid.webcomponent';

const grid = document.querySelector('node-projects-property-grid');
grid.typeName = 'Example';
grid.typeDefinitions = [{
  name: 'Example',
  properties: [{ name: 'title', type: 'string', description: 'Display title' }]
}];
grid.selectedObject = { title: 'Hello' };
grid.propertyChanged.on(({ property, newValue }) => console.log(property, newValue));
```

Give the grid a definite height and width. The package uses constructed stylesheets
and native CSS module imports; consumers need a browser/build pipeline that supports
these features. For a local browser example, run `npm install`, `npm run build`,
`npm start`, then open `/sample/collections.html`, `/sample/themed.html` or `/sample/index.html`.
The examples' import maps reference concrete ESM files from this package's own
`node_modules`, not directory URLs.

`/sample/themed.html` includes a live theme builder with labelled color, font,
spacing, radius, row/column, editor, header, description and category controls beside
an unchanged default-grid comparison. Try Dark/Light, **Connection grid** (22px,
muted gray, no extra cell padding) or **Connection form** (48px pale `#f1f2f4` rows,
30px controls). Each preset restores every managed setting; the initial sample remains
dark at 28px. The existing 22px reset changes only density. Copy the generated
`.inspector-theme` CSS (or select it manually if clipboard access is blocked), and
apply the separate layout JavaScript snippet. Theme off removes appearance variables
and optional part rules, but retains density, column share and region visibility.
The independent custom-editor-sheet toggle does not reset the theme.

## Styling

Three complementary hooks are supported:

1. **Inherited custom properties** for semantic themes, including across wrapper
   shadow roots. No `--pg-*` defaults are declared on the host, so ancestor values
   are not blocked. Missing inputs retain the package's original appearance.
2. **CSS parts** for individual elements, without depending on Wunderbaum classes.
3. **`additionalStyleSheets`** for per-instance rules inside the grid's shadow root,
   including custom editor classes. Do not mutate the shared package stylesheets.

```css
.inspector-theme {
  --pg-background: #20252d;
  --pg-color: #e5eaf2;
  --pg-border-color: #586575;
  --pg-grid-color: #394555;
  --pg-focus-color: #89baff;
  --pg-hover-background: #303f51;
  --pg-selected-background: #364d6b;
  --pg-header-background: #303946;
  --pg-description-background: #303946;
  --pg-editor-background: #20252d;
  --pg-editor-color: #e5eaf2;
  --pg-editor-border: 1px solid #586575;
  --pg-editor-font-family: system-ui;
}
node-projects-property-grid::part(category-row) { font-weight: bold; }
node-projects-property-grid::part(description-title) { color: #89baff; }
```

### Supported custom properties

All inputs are optional. Values are CSS values, not JavaScript numbers. The color
inputs bridge to Wunderbaum's host defaults. Direct `--wb-*` declarations **on the
grid host** remain advanced overrides; inherited `--wb-*` inputs alone can be blocked
by Wunderbaum's host defaults. Prefer the public `--pg-*` API.

| Input | Default / purpose |
| --- | --- |
| `--pg-background` | White tree background; outer container otherwise transparent |
| `--pg-color` | Tree text `#56534c`; other regions otherwise inherit |
| `--pg-border-color` | Tree border `#56534c` |
| `--pg-grid-color` | Row/cell separators `#dedede` |
| `--pg-row-background` | Transparent base rows (tree background shows through) |
| `--pg-alternate-row-background` | Base row background; visible-order stripes retain parity during virtual scroll |
| `--pg-category-background` | Base row background for category rows |
| `--pg-row-separator-color`, `--pg-cell-separator-color` | `--wb-grid-color` (bridged from `--pg-grid-color`) |
| `--pg-row-separator-style`, `--pg-cell-separator-style` | `solid`; supports `solid`, `dashed`, `dotted`, `none` without changing 1px geometry |
| `--pg-cell-padding-x` | `2px` horizontal cell padding, bridged to `--wb-col-padding-x` |
| `--pg-category-name-inset` | `0px` extra **local** name-cell padding, not per-depth indentation |
| `--pg-indent` | `20px` per-depth hierarchy indentation; expander slot remains `20px` |
| `--pg-category-font-weight` | Inherited weight |
| `--pg-focus-color` | Focused tree border `#275dc5`; editor outline fallback |
| `--pg-hover-background` | Wunderbaum's original pale blue hover |
| `--pg-hover-border-color` | Nonactive/nonselected hovered row border; otherwise transparent sides (focused sides retain their focus color) and `--wb-grid-color` bottom |
| `--pg-selected-background` | Active/selected `#e5f3fb`, unfocused `#f0f0f0` |
| `--pg-selected-border-color` | Active `#70c0e7`, unfocused gray |
| `--pg-selected-hover-background` | Active hover `#dceff8`, unfocused `#eaeaea` |
| `--pg-selected-hover-border-color` | Active hover `#26a0da` |
| `--pg-font-family` | Tree Helvetica/sans-serif; other regions retain original defaults |
| `--pg-font-size` | Tree `14px`; outer container otherwise inherits |
| `--pg-tree-border` | `2px solid var(--wb-border-color)`; focus changes border color |
| `--pg-tree-radius` | `4px` |
| `--pg-header-background` | `#f0f0f0` |
| `--pg-header-color` | Inherited text color |
| `--pg-header-border` | `1px lightgray solid` bottom border |
| `--pg-header-font-size` | `10pt` |
| `--pg-header-font-weight` | Inherited font weight |
| `--pg-header-padding` | `0 0 0 5px` |
| `--pg-description-background` | `#e6e6e6` |
| `--pg-description-color` | Inherited text color |
| `--pg-description-border` | `none` top border |
| `--pg-description-font-family` | `--pg-font-family`, otherwise Tahoma/Arial/Helvetica |
| `--pg-description-font-size` | `10pt` |
| `--pg-description-font-weight` | Inherited weight |
| `--pg-description-min-height` | `auto`; optional region minimum height |
| `--pg-description-max-height` | `none`; optional region maximum height with overflow scrolling |
| `--pg-description-padding` | `5px` |
| `--pg-description-title-margin` | `1.33em 0` |
| `--pg-description-title-font-weight` | `bold` |
| `--pg-description-text-margin` | `1em 0` |
| `--pg-editor-background` | Native control appearance |
| `--pg-editor-color` | Native control text |
| `--pg-editor-border` | Native border; direct text/number/color/select controls retain Wunderbaum's borderless default |
| `--pg-editor-radius` | Native border radius |
| `--pg-editor-padding` | Native padding |
| `--pg-editor-padding-inline` | Optional inline-axis override of editor padding; leaves block padding unchanged |
| `--pg-editor-font-family` | `--pg-font-family`, otherwise native font |
| `--pg-editor-font-size` | Native font size |
| `--pg-editor-height` | Native sizing (existing `.form-control` fallback `21px`); opt-in text/select/textarea/button height capped to inner row height; checkbox/radio and wrapper roots keep their existing sizing, including `21px` class roots |
| `--pg-editor-accent-color` | `auto` (checkbox/radio accent) |
| `--pg-editor-focus-border` | Direct input/select focus: original `1px dashed #70c0e7`; nested non-checkbox/radio input/select controls consume explicit tokens only, with no new fallback |
| `--pg-editor-focus-color` | `--pg-focus-color`, otherwise native outline color |
| `--pg-editor-focus-style`, `--pg-editor-focus-width` | Native outline style/width; opt-in focus-visible presentation |
| `--pg-expander-size` | `12px` background image size, both axes |
| `--pg-expander-position` | `3px 3px` background image position |
| `--pg-expander-filter` | `none`; for example `invert(1)` on dark backgrounds |
| `--pg-expander-opacity` | `1` |
| `--pg-collection-background`, `--pg-collection-color` | `--pg-background` / `--pg-color`, otherwise white / `#56534c` |
| `--pg-collection-border` | `1px solid var(--pg-border-color, #56534c)` |
| `--pg-collection-radius`, `--pg-collection-padding` | `6px`, `16px` |
| `--pg-collection-backdrop` | `rgb(0 0 0 / 35%)` |
| `--pg-collection-error-color` | `#b42318` |
| `--pg-collection-button-hover-background` | Editor/button surface mixed with 12% editor/button text color; fallback to `--pg-hover-background` or `#e5f3fb` without `color-mix` support |
| `--pg-collection-button-hover-color` | `--pg-editor-color`, otherwise `ButtonText`; enabled Edit/dialog buttons only |

Row/base/alternate/category backgrounds exclude hovered, active and selected rows so
interaction colors win. Background hooks are zero-specificity layered
`background-color` declarations: existing author colors and renderer status/busy
images are not erased. Separator rules activate only when their new style/color
tokens are present, using actual native borders (no pseudo-elements or border images).
Style `none` means a transparent **1px solid border**, not zero width. Row rules
exclude focus/hover/selection; row/cell feedback classes (`wb-invalid`, `wb-error`,
`wb-busy`, `wb-status-error`) retain existing paint. The scoped rules match only
Wunderbaum's built-in unfocused-grid separator specificity, so later scoped additional-sheet class rules and
CSS-part border authorship can override them. Missing tokens leave the original
border cascade, including last-cell behavior, untouched; explicit cell tokens theme
all grid-cell dividers. Authored borders still follow the normal cascade and CSS parts
are never masked. Category inset adds local padding, while `--pg-indent` changes
per-depth hierarchy spacing without changing the `20px` expander slot. Name labels
adjust to the available width when indentation changes; expander variables affect
only the background image.

Value cells and built-in nullable/any wrappers vertically center their editors by
default, without requiring an editor-height token. Custom wrapper contents should
provide their own internal alignment. Any editors keep a `4px` gap between the
non-shrinking type selector and the value control, which fills the remaining width.
Ordinary/later-layer author alignment and spacing win.

The **optional separator, inline-padding, indent, editor-height and nested
focus-border hooks require CSS container style-query support** for inherited custom
properties (supported by current Chromium). Browsers without that support retain
original spacing, sizing and separator styles. No JavaScript CSS-variable watchers
are installed. Without an editor-height token, only the any editor uses a zero
minimum width to fit its controls; no height caps are added.
With it, low-priority layered `:where()` rules size eligible native controls;
ordinary/later-layer author sizing still wins. Existing `.form-control` eligible
controls use a capped token height, while checkbox/radio and non-native wrapper
class roots retain `21px`. Custom wrappers should provide their own height caps.
Focus outline tokens apply only to `:focus-visible`.

For example, increase text inset without increasing editor height and reduce
hierarchy indentation:

```css
node-projects-property-grid {
    --pg-editor-padding: 1px 2px;
    --pg-editor-padding-inline: 8px;
    --pg-indent: 12px;
}
```

### Supported CSS parts

| Part | Element |
| --- | --- |
| `container` | Overall grid layout |
| `header` | Optional type-name header (`showHead = true`) |
| `tree-container` | Scroll/layout wrapper around the tree |
| `tree` | Wunderbaum tree element |
| `description` | Description region |
| `description-title` | Selected property's title |
| `description-text` | Selected property's description/default value |
| `row` | Every rendered category, object or leaf row |
| `category-row` | Category row, also `row` |
| `object-row` | Nested-type row, also `row` |
| `property-name` | Name cell, including category/object rows |
| `property-value` | Value cell when present (colspan rows can omit it) |
| `expander` | Rendered expand/collapse indicator |
| `editor` | Returned editor root and all native input/select/textarea/button descendants |
| `editor-input` | Native input controls |
| `editor-text`, `editor-number`, `editor-checkbox`, `editor-color` | Built-in input types; custom inputs also receive `editor-<input.type>` (e.g. `editor-radio`) |
| `editor-select`, `editor-textarea`, `editor-button` | Corresponding native controls |
| `editor-wrapper` | Built-in nullable/any wrapper |
| `nullable-editor` | Nullable wrapper |
| `nullable-toggle` | Nullable checkbox |
| `any-editor` | Any-type wrapper |
| `any-type-selector` | Any-type select |
| `collection-editor`, `collection-summary`, `collection-edit` | Compact leaf wrapper, count and Edit button |
| `collection-dialog`, `collection-title`, `collection-body` | Native modal, heading and wrapping body |
| `collection-entries`, `collection-label`, `collection-list`, `collection-toolbar` | Selection and entry actions |
| `collection-item`, `collection-key`, `collection-grid` | Item area, dictionary key input and nested grid host |
| `collection-null`, `collection-null-toggle` | Nullable collection's explicit null choice inside the modal |
| `collection-error`, `collection-footer`, `collection-action`, `collection-apply` | Alert, footer and buttons |

Parts are additive: existing custom editor part tokens are preserved. New virtualized
rows get the same hooks after scrolling, expansion, collapse or refresh. Native
light-DOM descendants created during connection or inserted later also receive parts,
including controls created in another document. Parts apply to elements in this
shadow root, not controls inside a nested custom editor's shadow
root. Style that editor through its own variables/parts or its own adopted sheets.

### Per-instance editor stylesheets

`additionalStyleSheets: readonly CSSStyleSheet[]` is **JavaScript-only**, not an HTML
attribute. Assign it before or after readiness, including before element upgrade.
The list is defensively copied on assignment and retrieval. Sheets themselves remain
normal constructed sheets; intentional changes to a shared sheet affect its adopters.
Native adoption errors (such as sheets from another document) surface to the caller.

```js
const controlStyles = new CSSStyleSheet();
controlStyles.replaceSync(`
  .application-editor { gap: 4px; }
  .application-editor input { background: #fff4cf; color: #202020; }
`);
grid.getSpecialEditorForType = async (property, value, path) => {
  if (property.name !== 'title') return null;
  const wrapper = document.createElement('div');
  wrapper.className = 'application-editor';
  const input = document.createElement('input');
  input.value = value ?? '';
  input.onblur = () => grid.setPropertyValue(path, input.value);
  wrapper.append(input);
  return wrapper;
};
grid.additionalStyleSheets = [controlStyles]; // after built-in sheets
grid.additionalStyleSheets = [replacementStyles]; // removes the old additional sheets
grid.additionalStyleSheets = []; // preserves only built-in sheets
```

Rules must still win the normal specificity cascade. Existing inline styles such as
editor width, flex growth, nullable margins and any-type `display` take precedence
over normal stylesheet/part rules. Avoid overriding any-type visibility (especially
with `!important`): only the currently selected input should be visible.
General editor theme defaults use zero-specificity selectors in the
`property-grid-editors` cascade layer, so ordinary class/tag rules and later author
layers retain their appearance without `--pg-*` inputs. Direct Wunderbaum editor
border and focus-border rules still have Wunderbaum's specificity.

### Row density

```html
<node-projects-property-grid row-height="28"></node-projects-property-grid>
```

```js
grid.rowHeight = 30; // works before readiness/upgrade and live after rendering
grid.rowHeight = 22; // restore the default
```

`rowHeight` is a finite JavaScript number of at least `4` CSS pixels; invalid values
throw `RangeError` without changing the previous state. `row-height` supplies an
initial value at readiness using the base component's decimal `parseFloat` behavior:
`28px` or `28malformed` means `28`, and `2.8e1` means `28`. `0x20` parses as `0`
and is rejected, as are empty/nonnumeric values or results below `4`/not finite,
without changing the last accepted height. Later attribute changes are not reactive;
use the property for live changes. An initial attribute takes precedence over a property
assigned before readiness. The property updates the numeric virtualization geometry,
outer row height and inner cell height (`rowHeight - 2`) together, with a resize
update rather than rebuilding the tree. Layout setters scroll an existing focused
editor's row into the updated viewport before virtualization, retaining its DOM,
selection and pending value. Validation/error feedback on retained rows/cells is
restored across the resize and ensuing observer update. Ordinary user scrolling,
refresh or collapsing away an edited row can still discard virtualized editors.

Rows have **fixed geometry**. Do not change row/cell height or vertical row padding
with CSS alone, or override `--wb-row-outer-height` / `--wb-row-inner-height`:
Wunderbaum also needs the numeric height to position and scroll rows correctly.
Large fonts, borders or custom editors must fit the chosen height; arbitrary
multiline/variable-height rows are not supported.

### Column share and region visibility

```js
// Apply separately from appearance CSS, before upgrade/readiness or live:
grid.rowHeight = 48;
grid.nameColumnRatio = 0.4;
grid.showHead = true;
grid.showDescription = false;
```

`nameColumnRatio` defaults to `0.5` and accepts only finite JavaScript numbers
strictly between `0` and `1`. Invalid assignments throw `RangeError` and retain the
last valid ratio. `name-column-ratio` is an initial decimal `parseFloat` attribute,
with the same parsing/precedence rules as `row-height`; later attributes are not
reactive. The setter changes numeric Wunderbaum column weights, clears dragged
custom widths and requests only a resize: it never reconstructs the tree. Tiny
ratios still respect Wunderbaum's minimum column width. The sample limits name
share to 25–70%; never fight the engine's inline column widths with CSS.

`showHead` defaults to **false**, `showDescription` to **true**. Their setters update
region display immediately without refresh or editor replacement. When a region
shrinks the tree viewport, the focused row is synchronously scrolled into view
before the renderer's ResizeObserver recalculates its virtual window. They support
pre-upgrade assignments and initial `show-head`/`show-description` attributes. Like
other base Boolean attributes, **presence means true**, including a value of
`"false"`; use the JavaScript property to hide the default-visible description.
Region typography, border, padding and optional description min/max height are
appearance CSS, not visibility. The builder's font-size control remains linked to
tree, editor, header and description; independent region size selectors can override
it, and changing the linked size restores their Inherit option. Explicit editor
height is opt-in (Auto/off preserves native sizing); fit warnings account for fonts,
padding, borders, focus and fixed density. Layout export intentionally persists when
the appearance preview is disabled.

## Wrapper integration

No application tokens or dependencies are built into this package. Map an
application's semantic tokens on an ancestor or the wrapper host. For example,
a custom wrapper can map application-defined tokens in its own stylesheet:

```css
property-grid-wrapper {
  --pg-background: var(--app-surface);
  --pg-color: var(--app-text);
  --pg-border-color: var(--app-border);
  --pg-grid-color: var(--app-border);
  --pg-focus-color: var(--app-focus);
  --pg-hover-background: var(--app-hover-surface);
  --pg-selected-background: var(--app-selected-surface);
  --pg-font-family: var(--app-font-family);
  --pg-header-background: var(--app-secondary-surface);
  --pg-description-background: var(--app-secondary-surface);
  --pg-editor-background: var(--app-surface);
  --pg-editor-color: var(--app-text);
}
```

Variables inherit through the wrapper's shadow root without forwarding. Parts need
explicit `exportparts` **on the inner grid in the wrapper template**:

```html
<node-projects-property-grid
  exportparts="container, header, tree-container, tree, description,
    description-title, description-text, row, category-row, object-row,
    property-name, property-value, expander, editor, editor-input,
    editor-text, editor-number, editor-checkbox, editor-color,
    editor-select, editor-textarea, editor-button, editor-wrapper,
    nullable-editor, nullable-toggle, any-editor, any-type-selector">
</node-projects-property-grid>
```

Then external CSS can use `property-grid-wrapper::part(editor)` or
`property-grid-wrapper::part(category-row)`. Forward parts again at every additional
wrapper boundary. Wrapper code can pass its constructed editor sheets via
`innerGrid.additionalStyleSheets = [editorStyles]` and set `innerGrid.rowHeight`.
Custom editors supplied through `createEditorFunction` follow the same rule:
light-DOM editor class rules belong in these additional sheets; nested web component
shadow contents require their own styling API.

A wrapper may also have its own header, separate from this package's `header` part.
Style that header in the wrapper. Existing overrides that explicitly set `--wb-*`
on the inner grid, including shared stylesheet patches, still take precedence over
the `--pg-*` bridge and should be reviewed when adopting this API. To use custom control
classes, assign their constructed stylesheet through `additionalStyleSheets` and
apply the corresponding classes to custom editor markup.

## Collection editing

Collections remain compact leaf rows, even if `getTypeInfo` resolves a type named
`array` or `dictionary`. Edit opens a labelled native modal outside the virtual tree.
Lists support add/remove and move up/down; dictionaries support add/remove and key
rename. Dictionary keys are literal own string keys: dots, Unicode, empty strings,
`__proto__`, `constructor` and `prototype` are safely stored without path traversal.

```js
grid.typeName = 'Settings';
grid.typeDefinitions = [{ name: 'Settings', properties: [
  { name: 'tags', type: 'array', collection: { item: { type: 'string' } } },
  { name: 'weights', type: 'dictionary', collection: { item: { type: 'number' } } },
  { name: 'records', type: 'array', nullable: true, collection: {
    item: { type: 'Record' },
    createItem: async () => ({ title: 'New record', enabled: true, tags: [] })
  } }
] }, { name: 'Record', properties: [
  { name: 'title', type: 'string' }, { name: 'enabled', type: 'boolean' },
  { name: 'tags', type: 'array', collection: { item: { type: 'string' } } }
] }];
grid.selectedObject = { tags: ['draft'], weights: { primary: 1 }, records: [] };
```

`IProperty.type` accepts named strings as well as built-ins. `collection` has
`item?: IProperty` and `createItem?: () => unknown | Promise<unknown>`.
`defaultValue?: unknown` supports structured item defaults. Types `IProperty`,
`ITypeInfo`, `ICollectionOptions` and `CollectionValue` are available from both the
main `PropertyGrid` entry point and `dist/index.js` (TypeScript type exports).
Explicit item metadata wins; without it, each entry is inferred as a primitive,
array or plain record. Named object fields resolve through the owning grid's
`getTypeInfo`, retaining that callback's parent binding. Nested lists/dictionaries
reuse that resolver for named and private inline-schema item types, including Add.
Untyped added entries start at null and offer the `any` selector. Collection enum
`values` may contain strings, finite numbers or booleans; creation/defaults and edits
retain their types. Mixed primitive choices use internal index values so `'1'` and
`1` remain distinct (string labels are quoted). Ordinary scalar enum editing is unchanged.

Add uses the factory first, a deeply cloned item `defaultValue` second, and a typed
default last: empty string, zero, false, black color, first enum option, empty
collection or recursively defaulted named record. Nullable named fields start at
null; recursive nonnullable defaults require a factory and fail visibly. Factories
may be asynchronous; conflicting controls are disabled, errors are visible and late
results after Cancel or invalidation are ignored. Factory results are also cloned.

Opening never initializes the outer value. Null and missing collections offer an
empty draft; nullable collections expose **Set to null** inside the dialog. Apply
explicitly replaces the value (or null) through one `setPropertyValue` call and one
outer `propertyChanged` event. It updates the summary without rebuilding the parent.
Cancel/Escape never mutate the original or emit outer draft events. Native pending
fields are tracked only after actual value/type/null edits, before selection/actions/Apply.
Untouched undefined values, missing fields, sparse holes and unmatched enum values
are preserved; displayed defaults are not implicit writes. Changed enum values must
be members of `values`. Empty or nonfinite edited numeric fields block actions,
even when their virtual row scrolls away; returning to the row restores the pending
input so it can be corrected. Aliased fields retain the last actual edit, never a
stale untouched control's value. Draft grids reuse native editors but contain their
events and numeric normalization; ordinary scalar behavior is not changed.

Nullable primitive items have a checkbox (checked means enabled) that disables the
value input while null. Nullable named object items/fields offer **Enable value** /
**Enable field**: checking creates a cloned default record, unchecking sets null.
Disabling an object field detaches only that field; aliased siblings retain their
record. Nested collection object replacements still preserve collection aliases.
Untouched null or missing object parents are not expanded or initialized. Finite
recursive records stop at nullable null boundaries; nonnullable null object items
are rejected, and recursive nonnullable default creation still needs a factory.
Async schema/editor creation disables selection, null toggles and conflicting
actions until ready; Cancel/Escape remains available. Unsupported metadata and
editor failures show an alert rather than allowing Apply or an unhandled rejection.

The supported clone domain is an acyclic graph of arrays, plain records (including
null-prototype records), finite numbers, strings, booleans, null and undefined.
Shared aliases are preserved in the draft and in the applied replacement, but no
original object reference is retained. Cycles, accessors, classes, functions,
symbol keys, nonenumerable own data properties and other nonplain values are
visibly rejected, even on initial open. Native array `length` is the only
nonenumerable exception. Enumerable readonly data fields are supported: clones
become writable/configurable data properties; original descriptor flags stay intact.
Object-grid field names cannot be empty, dotted or prototype-sensitive; these are
rejected clearly rather than addressed unsafely. Use a dictionary or replacement
editor for such object shapes. Map/Set, tuples and arbitrary serialization are not
supported.

Changing `selectedObject`, refresh, clear or disconnect closes drafts. Opening and
each action/Apply check the original object, current property reference and virtual
row ownership, so external replacement cannot commit an obsolete result. External
**in-place** mutation is not concurrent editing support: close/refresh the editor
when changing the same collection externally. Layout-only changes do not invalidate
an otherwise owned session. Nested modal sessions belong to their own draft grids;
Cancel closes only that session and its descendants, not other grids' dialogs.

Collection dialogs inherit `--pg-*`, use the collection tokens/parts above, wrap on
narrow screens and retain native closed-dialog hiding. Draft grids inherit tokens,
copy instance `additionalStyleSheets`, row height, column share and description
visibility at creation; categories/header are intentionally suppressed and objects
expanded. Parent `getSpecialEditorForType` is **not** copied into drafts: custom
closures may refer to the real parent object. Parts inside a draft grid's shadow
root require its own styling API; shared instance sheets apply there too.

### Replacing the collection editor

The existing async `getSpecialEditorForType` hook runs before the default. Return
a control to replace it, or null to retain fallback. It supports pre-upgrade
assignment and ignores stale async results, including collection-reference changes
while the same object/row remains owned (refresh to request a fresh editor).
Replacement controls own their edit
transaction, validation, stale guards and event behavior. For example, a deliberately
restricted string-list editor can use a textarea without trusting arbitrary JSON:

```js
grid.getSpecialEditorForType = async (property, value, path) => {
  if (property.type !== 'array' || property.collection?.item?.type !== 'string') return null;
  const ownerObject = grid.selectedObject;
  const wrapper = document.createElement('div');
  const input = document.createElement('textarea');
  input.setAttribute('aria-label', `${property.name} (one string per line)`);
  input.value = Array.isArray(value) ? value.join('\n') : '';
  const apply = document.createElement('button');
  apply.type = 'button';
  apply.textContent = 'Replace strings';
  apply.setAttribute('aria-label', `Replace ${property.name}`);
  apply.onclick = () => {
    if (grid.selectedObject !== ownerObject || !wrapper.isConnected) return;
    grid.setPropertyValue(path, input.value === '' ? [] : input.value.split('\n'));
  };
  wrapper.append(input, apply);
  return wrapper;
};
```

The simple JSON Schema converter additionally recognizes `type: 'array'` with
a single supported `items` schema, and unambiguous `type: 'object'` with a schema
in `additionalProperties`. Primitive/enum values and local `#/definitions/Name`
object references are supported; inline object array items retain a private schema
path so their fields resolve. Ordinary property references retain prior behavior.
Boolean additionalProperties, unions, tuples and full JSON Schema validation are
outside this converter's scope.

## Development

```sh
npm install
npm run build
npm run test:install
npm test
git diff --check
npm pack --dry-run
```

The real-browser suite runs Chromium through Playwright with a local static server
and native CSS module imports. The test scripts use POSIX environment assignment
(macOS/Linux) and keep downloaded browsers inside this package's `node_modules`.
Tests, planning documents and generated reports are
excluded from the npm package. The checked-in custom-elements manifest documents the
public styling API. Also usable in
[web-component-designer](https://node-projects.github.io/web-component-designer-demo/index.html).

### Release (maintainers only)

Create and publish a GitHub release with an unused version tag (for example,
`v2.0.2` or `2.0.2`) to publish the npm package. The publish workflow takes the
version from that tag, updates the npm manifests, builds, and publishes to npm.
Pushes and draft GitHub releases do not publish an npm package.

Optionally, use `npm run release` to prepare and push a version commit and tag.
This command does not create a GitHub release or publish to npm; publish the
GitHub release manually when ready.
