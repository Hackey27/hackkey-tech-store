import type { Firestore } from '@google-cloud/firestore';
import { COLLECTIONS, getFirestore } from './firestore';
import { cleanHackPost, cleanHackTheme, HackPost, HacksCatalogue, HackTheme, publicHacks } from '../shared/hacks';

export async function getHacksData(db: Firestore = getFirestore()): Promise<HacksCatalogue> {
  const [themes, posts] = await Promise.all([db.collection(COLLECTIONS.hackThemes).get(), db.collection(COLLECTIONS.hackPosts).get()]);
  return { themes: themes.docs.map(doc => ({ ...doc.data(), themeId: doc.id }) as HackTheme).sort((a, b) => a.sortOrder - b.sortOrder), posts: posts.docs.map(doc => ({ ...doc.data(), postId: doc.id }) as HackPost) };
}
export async function getPublicHacks(db: Firestore = getFirestore()) {
  const [themes, posts] = await Promise.all([db.collection(COLLECTIONS.hackThemes).where('active', '==', true).get(), db.collection(COLLECTIONS.hackPosts).where('active', '==', true).get()]);
  return publicHacks(themes.docs.map(doc => ({ ...doc.data(), themeId: doc.id }) as HackTheme), posts.docs.map(doc => ({ ...doc.data(), postId: doc.id }) as HackPost));
}
export async function saveHackTheme(themeId: string, input: HackTheme, db: Firestore = getFirestore()) {
  const theme = cleanHackTheme(themeId, input);
  await db.collection(COLLECTIONS.hackThemes).doc(themeId).set(theme);
  return theme;
}
export async function saveHackPost(postId: string, input: HackPost, db: Firestore = getFirestore()) {
  const clean = cleanHackPost(postId, input);
  return db.runTransaction(async tx => {
    const ref = db.collection(COLLECTIONS.hackPosts).doc(postId);
    const [current, theme] = await Promise.all([tx.get(ref), tx.get(db.collection(COLLECTIONS.hackThemes).doc(clean.themeId))]);
    if (!theme.exists) throw new Error('Save the theme before adding a post.');
    const now = new Date().toISOString();
    const post: HackPost = { ...clean, createdAt: current.data()?.createdAt || now, updatedAt: now, views: current.data()?.views || 0 };
    tx.set(ref, post);
    return post;
  });
}
export async function recordHackView(postId: string, db: Firestore = getFirestore()) {
  return db.runTransaction(async tx => {
    const ref = db.collection(COLLECTIONS.hackPosts).doc(postId);
    const post = await tx.get(ref);
    if (!post.exists || !post.data()?.active) throw new Error('Post not found.');
    const theme = await tx.get(db.collection(COLLECTIONS.hackThemes).doc(post.data()!.themeId));
    if (!theme.exists || !theme.data()?.active) throw new Error('Post not found.');
    const views = (Number(post.data()?.views) || 0) + 1;
    tx.update(ref, { views });
    return views;
  });
}
