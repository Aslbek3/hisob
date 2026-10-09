"use client";

import { useEffect } from "react";
import { toLatin } from "@/lib/translit";
import { ALPHABET_EVENT, type Alphabet, readAlphabet } from "@/lib/alphabet";

const SKIP_TAGS = new Set(["SCRIPT", "STYLE", "TEXTAREA", "INPUT", "NOSCRIPT"]);
const OBSERVE_OPTS: MutationObserverInit = { subtree: true, childList: true, characterData: true };

function isSkippable(node: Node): boolean {
  let el: HTMLElement | null = node.nodeType === Node.TEXT_NODE ? node.parentElement : (node as HTMLElement);
  while (el) {
    if (SKIP_TAGS.has(el.tagName) || el.hasAttribute("data-no-translit") || el.isContentEditable) return true;
    el = el.parentElement;
  }
  return false;
}

function walkTextNodes(root: Node, fn: (node: Text) => void) {
  if (root.nodeType === Node.TEXT_NODE) {
    fn(root as Text);
    return;
  }
  if (isSkippable(root)) return;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  let n: Node | null;
  while ((n = walker.nextNode())) nodes.push(n as Text);
  for (const node of nodes) fn(node);
}

/**
 * Root layout'da bir marta chiqadigan "ko'rinmas" komponent: ekrandagi matn
 * tugunlarini joriy alifbo tanloviga qarab o'giradi.
 *
 * Har bir matn tugunining ASL (kirill) qiymati WeakMap'da saqlanadi — rejim
 * kirillga qaytganda shu asl qiymat tiklanadi (toCyrillic bilan "teskari
 * o'girish" EMAS), chunki ekrandagi matn har doim toza kirill bo'lmaydi
 * ("Ҳисобот (Excel)" kabi ichida lotin so'z bor matnlar ham bor — ularni
 * algoritm bilan teskari o'girishga urinish buzib qo'yardi).
 *
 * React qayta chizganda ham ishlashi uchun MutationObserver bilan kuzatadi:
 * React har doim bazadagi (kirill) matnni qayta chizadi, shuning uchun har
 * bir "characterData"/"childList" o'zgarishi YANGI asl qiymat sifatida qabul
 * qilinadi. O'zimiz yozgan o'girilgan matn observerga tushib, cheksiz aylanib
 * qolmasligi uchun o'z yozishlarimiz paytida observer vaqtincha uzilib turadi.
 */
export function AlphabetOverlay() {
  useEffect(() => {
    let mode: Alphabet = readAlphabet();
    document.documentElement.dataset.alphabet = mode;
    const original = new WeakMap<Text, string>();

    // React (yoki SSR) tomondan YANGI qo'yilgan kirill matn — asl qiymat sifatida saqlanadi
    function captureAndRender(node: Text) {
      if (isSkippable(node)) return;
      original.set(node, node.data);
      if (mode === "lat") {
        const next = toLatin(node.data);
        if (next !== node.data) node.data = next;
      }
    }

    // Faqat qayta ko'rsatish — saqlangan asl qiymatni joriy rejimga mos chiqaradi
    function renderNode(node: Text) {
      if (isSkippable(node)) return;
      const orig = original.get(node);
      if (orig === undefined) return;
      const next = mode === "lat" ? toLatin(orig) : orig;
      if (next !== node.data) node.data = next;
    }

    walkTextNodes(document.body, captureAndRender);

    const observer = new MutationObserver((mutations) => {
      observer.disconnect();
      for (const m of mutations) {
        if (m.type === "characterData") captureAndRender(m.target as Text);
        else if (m.type === "childList") m.addedNodes.forEach((added) => walkTextNodes(added, captureAndRender));
      }
      observer.observe(document.body, OBSERVE_OPTS);
    });
    observer.observe(document.body, OBSERVE_OPTS);

    function onToggle(e: Event) {
      const next = (e as CustomEvent<Alphabet>).detail;
      if (next === mode) return;
      observer.disconnect();
      mode = next;
      walkTextNodes(document.body, renderNode);
      observer.observe(document.body, OBSERVE_OPTS);
    }
    window.addEventListener(ALPHABET_EVENT, onToggle);

    return () => {
      observer.disconnect();
      window.removeEventListener(ALPHABET_EVENT, onToggle);
    };
  }, []);

  return null;
}
