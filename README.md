# Kurai 3D Assets

Portfolio website for Kurai 3D Assets.

## Updating content

The main editable content is in `site-data.js`.

- Profile/contact data: `profile`
- Asset cards: `assets`
- If a store URL is left empty (`""`), that store button is not shown.
- Search uses the asset title, description and hidden `keywords` list.

The site is designed for GitHub Pages and does not require a backend.


## Optional links and visible tags

- Add visible asset chips with the `tags` array.
- Add hidden search terms with the `keywords` array.
- Add the creator YouTube channel as a profile contact.
- Add a per-asset YouTube video with the `youtube` field. If it is empty, the button is not shown.
- Fab and Unity buttons are also hidden automatically when their URL is empty.
