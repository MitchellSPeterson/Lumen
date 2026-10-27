# Lumen iOS companion: mobile UI pattern research (Appllama)

Credits used: 11 of ~40 budget (1500 monthly; 1489 left). Method: 11 semantic searches, ~14 screens viewed as images (the rest read from metadata names/flows).

Coverage caveat: the catalog has NO usable phone kanban screen (a Trello app-scoped search returned 0; Trello "Boards" is a board list only) and no real hierarchical-mind-map-on-phone beyond MindNode. Sections 5 and 6 are partly extrapolated, flagged below. Multi-select was seen only as menu entries ("Select", "Batch edit with Select mode"), not as a bar.

Screens actually viewed (app: screen): Tasks (1502903102): Home, Task Field Menu, App Theme Selector, Group By Menu, Priority Filter Menu (metadata). OmniFocus 4: Projects Overview, Task Action Menu, Task Note Expanded. Superlist: New Task Composer, Sidebar Navigation (metadata). Sorted3: Task Details. MindNode: Insert Menu, Node Text Editing. TickTick: List Context Menu. Trello: Boards Create Menu. Tot Pocket: Advanced Settings. Todoist: Quick Add Task.

## 1. Project list (home)
Refs: Tasks "Home", Superlist "Sidebar Navigation"/"Lists", OmniFocus "Projects Overview", Trello "Boards".
- Skeleton: large title, then collapsible sections ("Filters", "Projects") with chevron-disclosure headers; rows = icon + name + trailing count + chevron. Inset grouped list on the system grouped background.
- Nav: push into a project. Tasks keeps Search and "+" as a floating bottom pair (wide search pill + circular "+") instead of a tab bar.
- Primary CTA: bottom-right circular "+" (new project / capture); top-left circular glass button for settings.
- Lumen take: sections = "Now / Next / Later" smart rows (counts) above "Projects". Trailing count in secondary color, no row dividers beyond hairline inset. Settings gear top-left, not a tab.

## 2. Hierarchical outline, collapse, multi-select
Refs: OmniFocus "Projects Overview", "Task Note Expanded", "Task Action Menu"; TickTick "List Context Menu"; Superlist "Lists".
- Skeleton: group rows are bold with a trailing chevron toggle that collapses children; children indent about 20pt under the group, with the completion circle at the leading edge (OmniFocus). Indent via leading inset only, not nested cards.
- Per-row trailing glyph (note icon) signals hidden content; date chip under title in small secondary text.
- Context menu (long-press) = iOS 26 style rounded menu: Edit > Organize > Schedule submenus, then Flag/Complete/Drop, then Inspect/Focus, then destructive Delete in red, separated by dividers. A preview card of the row floats above the menu.
- Multi-select: enter via an overflow "..." menu "Select" (Tasks/Superlist/TickTick all do this), not edit-mode on the list nav bar. Show a top "N selected" pill with an X, plus a bottom action bar.
- Lumen take: swipe leading = status cycle, trailing = delete/move; long-press = context menu; collapse state persisted per item. Cap visible indent at about 4 levels, then flatten with a breadcrumb.

## 3. Task detail / editor
Refs: OmniFocus "Task Note Expanded" (inline expansion), Sorted3 "Task Details", Tasks "Modify Fields", Tody "Task Notes".
- Two models seen. Inline expansion (OmniFocus): tapping a row opens a card inside the list showing Tags, Due, and a note area, with a flag top-right and attachment bottom-right. Full screen (Sorted3): a close chevron top-left, a date/context chip as the title bar, a trash icon top-right, the task title as large editable text, then rich-text notes directly below with checklist circles, then a tag chip row at the bottom.
- Fields are quiet: placeholder rows with icon + dim label (Tags, Due) that light up when set. No form chrome.
- Notes are first-class: markdown-style editing with the keyboard accessory bar.
- Lumen take: formSheet/pushed detail with title field, a horizontal property chip row (Status, Priority, Tags as menus), then the notes body filling the rest, then subtasks as a nested list under the notes. Status and priority use native pull-down Menus (not pickers); trash lives in the nav bar's "..." menu.

## 4. Quick capture
Refs: Todoist "Quick Add Task", Superlist "New Task Composer", Tasks "Home Create Menu".
- Skeleton: bottom sheet above the keyboard, auto-focused. Title field, then a Description line, then a horizontal scroll row of dashed or outlined chips (Date, Attachment, Priority, Reminder; Superlist: Inbox, Due date, Assignee), then a bottom row with destination picker on the left ("Inbox v") and a circular filled send button (red up-arrow in Todoist, check in Superlist) on the right.
- Chips open small anchored menus (Todoist Priority = four colored flags in a popover).
- Superlist adds a type switch above the keyboard (Task / List / Talk).
- Dismissal: X top-left (Superlist) or swipe down; the primary CTA is the circular send button at the keyboard's trailing side.
- Lumen take: sheet with detents (medium), title only is enough to submit, destination defaults to Inbox/last project, chips for Type (idea/task/feature/bug), Priority, Lane (Now/Next/Later). Trailing circle button; support "return = add and keep open".

## 5. Kanban on phone (extrapolated; no real catalog reference)
Refs: Tasks "Group By Menu" (Group by: Status), Trello "Boards" screen.
- The only usable cue: Tasks exposes Group by Status via a top-right menu and a 2-dot page indicator at the bottom, implying paged views.
- Recommended: one column per page (full-width, paging scroll snap), with a sticky segmented/capsule header listing status names and counts. Cards show title, priority dot, and tag chip at most. Move-to-column through the long-press context menu "Move to..." as the primary path, drag across pages as an enhancement.
- Avoid a faithful desktop horizontal scrolling board at 320 pt wide.

## 6. Mind map on phone (MindNode only)
Refs: MindNode "Insert Menu", "Node Text Editing".
- Canvas on a flat grouped-gray background, nodes as white rounded rectangles with a small purple "+" handle on the trailing edge; dragging the "+" creates a child node.
- Selected node shows round handles; text edited inline; the keyboard accessory row has mode buttons (add child/sibling) with an insert pop-up menu (Add Task, Link, Tags, Notes, Emoji, Photo) and a trailing check button.
- Lumen take: read-mostly pan and pinch canvas, tap a node = detail sheet, long-press = context menu; always give an "Outline" toggle since editing is better in the list. Default to collapsed branches.

## 7. Search + filters
Refs: Tasks "Task Field Menu", "Group By Menu", "Priority Filter Menu"; Todoist; Drafts "Tag Filter".
- Search sits as a bottom floating pill (Tasks) or a top inline pill below the title (Superlist). Prefer the bottom pill for thumb reach.
- Filtering is a single anchored popover from the top-right: rows with icon + title + current value subtitle ("Status: Ignore", "Group by: Status") and chevron into submenus; tri-state values Select/Ignore.
- Priority and tag filters use color-coded flags and tags; selected filters should show as removable chips under the search field.
- Lumen take: .searchable with scopes (All / Ideas / Tasks / Bugs), plus a filter button in the nav bar opening the same field-menu structure (Status, Priority, Tags, Lane, Group by).

## 8. Settings
Refs: Tasks "App Theme Selector", Tot Pocket "Advanced Settings", Tasks Settings list (Notification, Import Data), Tiimo/ChatGPT "Settings".
- Inset grouped list with section headers; rows have a small colored icon, bold title, and gray subtitle explaining the setting ("Save your projects and tasks to a .tasks file").
- Theme picker = centered alert-style dialog: System / Light / Dark / Cancel as full-width pills. Better for Lumen: an inline row with a Menu and an accent swatch grid (a horizontal row of circles).
- Back = round glass chevron top-left, centered title; the page is pushed, not modal.
- Backup/Export: Tot uses a separate "Advanced" screen: tinted text buttons (Export Data, Reset Theme) in separate white cards, each with a grey footnote below describing the effect (for example "save as JSON in the Files app"). Restore Backup uses a chevron row.
- Lumen take: Export = share sheet with JSON/Markdown; destructive actions in red, footnote on every action.

## Top decisions (summary)
1. Home is a grouped list with collapsible sections and trailing counts; settings is a top-left round button, not a tab.
2. Floating bottom bar (search pill + circular "+"), not a heavy tab bar.
3. Outline: bold group rows with chevron collapse, children indented under a leading checkbox; swipe actions plus long-press context menu in iOS 26 style.
4. Multi-select enters from the "..." menu and shows a top "N selected" pill with a bottom action bar.
5. Detail view is title, property chip row (native Menus), then a full-height markdown note with checklist circles; subtasks below.
6. Quick capture is a keyboard-focused detent sheet with option chips and a circular send button at trailing bottom.
7. Board: one status column per page with a count header; "Move to..." in the context menu.
8. Mind map is read-mostly pan/zoom with a plus handle; always offer an Outline switch.
9. Filter via a single anchored popover of field rows (value subtitle + chevron) plus removable chips.
10. Settings pushed, inset grouped, footnotes explain each action; Export/Restore sit in an "Advanced" section.
