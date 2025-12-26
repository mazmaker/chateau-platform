# Page snapshot

```yaml
- generic [ref=e2]:
  - region "Notifications (F8)":
    - list
  - region "Notifications alt+T"
  - generic [ref=e5]:
    - img [ref=e7]
    - heading "ไม่มีสิทธิ์เข้าถึง" [level=2] [ref=e9]
    - paragraph [ref=e10]:
      - text: คุณต้องมีสิทธิ์ระดับ
      - strong [ref=e11]: owner
      - text: ในการเข้าถึงหน้านี้
    - paragraph [ref=e12]: "สิทธิ์ปัจจุบัน: ไม่มี"
  - generic [ref=e13]:
    - img [ref=e15]
    - button "Open Tanstack query devtools" [ref=e63] [cursor=pointer]:
      - img [ref=e64]
```