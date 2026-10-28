# Workbench theme

Flat white surfaces on a pale grey canvas. No decorative surface gradients. Small shadows only on cards and floating layers. Shared rules live in `app/workspace-white.css`; loading rules in `app/data-loading.css`.

| Meaning | Text / accent | Use |
| --- | --- | --- |
| Primary | #245fbd | Main buttons, selection, approved amounts |
| Positive | #087e60 | Incoming funds, available balance, success |
| Attention | #95620d | Pending actions, review |
| Negative | #ba3b51 | Outgoing funds, overdue, deletion, error |
| Body | #20334b | Main text |
| Secondary | #62748a | Supporting text |
| Line | #dce4ed | Panel boundaries |

Keep text labels and icons alongside semantic color. Use a visible blue keyboard focus ring. Buttons are 32px on desktop (table actions 30px), 40px on narrow screens. Cards use 10px corners; controls use 7px. Tables retain local scrolling and light alternating rows; the outer workspace stays within the viewport. Toasts remain at the upper right, including inside dialogs. Chart areas may use transparency to encode data; backgrounds stay flat.
