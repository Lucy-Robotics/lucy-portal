# Home page feature illustrations

Drop an image here named after a feature's slug and it appears next to that
feature on the home page; no code change needed. Until then the feature shows a
placeholder with its icon.

Formats: `.webp` (preferred), `.avif`, `.png`, `.jpg`, `.svg`, `.gif`.
The slot is 4:3 and the image is fitted inside it (`object-fit: contain`), so a
transparent background works best.

| Feature                  | File name              |
| ------------------------ | ---------------------- |
| Drive it your way        | `drive.webp`           |
| See it live              | `live-view.webp`       |
| Poses & animations       | `poses.webp`           |
| Hardware configuration   | `hardware-config.webp` |
| Multi-client, one driver | `multi-client.webp`    |
| Open & portable          | `open-portable.webp`   |

Slugs are set in `src/pages/Home.tsx` (`FEATURES`).
