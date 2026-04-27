# Page snapshot

```yaml
- generic [ref=e2]:
  - region "Notifications (F8)":
    - list
  - region "Notifications alt+T"
  - generic [ref=e4]:
    - heading "404" [level=1] [ref=e5]
    - paragraph [ref=e6]: Oops! Page not found
    - link "Return to Home" [ref=e7] [cursor=pointer]:
      - /url: /
  - generic [ref=e8]:
    - img [ref=e10]
    - button "Open Tanstack query devtools" [ref=e58] [cursor=pointer]:
      - img [ref=e59]
```