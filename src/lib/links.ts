/**
 * Public links shown on /pitch/close, slides and README. The lead fills these in at the end.
 * /pitch/close hides any link that still contains REPLACE_ME.
 *
 * liveUrl and github keep their original addresses after the rename to Tesseract, so links in
 * already-submitted materials keep working. Deploy to the existing Vercel project that serves liveUrl; do not create a new
 * project (the bare <name>.vercel.app subdomain is taken by an unrelated app). After a deploy, check /, /pulse and /demo on liveUrl in an incognito window.
 */
export const LINKS = {
  liveUrl: "https://onerecord-lives-dsa26.vercel.app",
  github: "https://github.com/ethantyh03/onerecord",
  youtube: "https://youtu.be/5tieuSmd2Aw",
};
