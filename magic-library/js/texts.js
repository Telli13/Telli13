// All words shown on screen live here, so they are easy to change or translate.
window.ML = window.ML || {};
ML.T = {
  favorites: 'Favorites',
  searchPlaceholder: 'Search spell…',
  searchNothing: 'No book answers this spell…',
  exit: 'Exit',
  close: 'Close',
  prevBookcase: 'Previous bookcase',
  nextBookcase: 'Next bookcase',
  hint: '← → move between bookcases · just start typing to cast a search',
  hintBook: '← → turn pages · Backspace: back one chapter · Esc: close the book',
  demoLabel: 'Sample library:',
  demoLabelShort: 'Sample:',
  calm: 'Calm',
  calmOffTitle: 'Calm mode is off: click to dim the effects for daily work',
  calmOnTitle: 'Calm mode is on: no parallax, no dust, steady candles',
  demo: { normal: 'Normal', few: 'Few folders', many: 'Many folders' },
  part: (i, n) => `${i} of ${n}`,
  chapter: n => `Chapter ${n}`,
  counts: (folders, files) => {
    const parts = [];
    if (folders) parts.push(folders === 1 ? '1 chapter' : `${folders} chapters`);
    if (files) parts.push(files === 1 ? '1 scroll' : `${files} scrolls`);
    return parts.join(' · ') || 'empty';
  },
  folderMeta: 'chapter ›',
  emptyChapter: 'This chapter is empty — only dust and silence.',
  theEnd: 'Finis',
  openFile: name => `✨ “${name}” would open now. (Prototype: there are no real files yet.)`,
  exitTitle: 'Leave the library?',
  exitText: 'In the real app this takes you back to the normal Windows desktop.',
  exitStay: 'Stay',
  exitLeave: 'Leave',
  farewellTitle: 'You have left the library',
  farewellText: 'Here you would now see your normal Windows desktop. (This is the browser prototype.)',
  farewellBack: 'Return to the library',
  more: n => `+${n}`,
};
