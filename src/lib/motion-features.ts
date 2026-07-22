/**
 * Motion feature bundle for LazyMotion, isolated in its own module so the
 * bundler can code-split it — the main chunk ships only the tiny `m`
 * components and this loads alongside first paint. domMax (not domAnimation)
 * because the shell uses layout animations (Segmented's sliding thumb,
 * popLayout list exits).
 */
export { domMax as default } from "motion/react";
