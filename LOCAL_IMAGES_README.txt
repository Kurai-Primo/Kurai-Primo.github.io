LOCAL IMAGE SETUP
=================

site-data.js now points only to LOCAL image paths for the newly added Fab assets.
No media.fab.com image hotlinks are used by the website at runtime.

The ChatGPT sandbox used to prepare this archive cannot download binary files from Fab CDN.
To fetch the source screenshots once on your Windows PC, run:

    DOWNLOAD_FAB_IMAGES.bat

(or DOWNLOAD_FAB_IMAGES.ps1)

After the download, the site reads the images only from assets/images/.../cover.jpg.
You can replace any cover.jpg later without editing site-data.js.

Unity links added:
- Retro PC IBN 5100 -> IPN Retro Computer: https://assetstore.unity.com/packages/package/403430
- IBN AT 5170 Retro PC -> IPN AT Retro Computer: https://assetstore.unity.com/packages/package/403468
