import { Router } from 'express';
import { db, getSettings, nowIso } from '../db.js';

const router = Router();

const THEME_MODES = ['light', 'dark', 'system'];
const PALETTES = ['emerald', 'navy', 'amber', 'slate'];

router.get('/', (_req, res) => {
  const s = getSettings();
  res.json({
    id: s.id,
    officer_name: s.officer_name,
    badge_no: s.badge_no,
    theme_mode: s.theme_mode,
    color_palette: s.color_palette,
    updated_at: s.updated_at,
  });
});

router.put('/', (req, res) => {
  const b = req.body || {};
  const theme_mode = THEME_MODES.includes(b.theme_mode) ? b.theme_mode : getSettings().theme_mode;
  const color_palette = PALETTES.includes(b.color_palette) ? b.color_palette : getSettings().color_palette;

  db.prepare(
    `UPDATE settings SET
      officer_name = @officer_name,
      badge_no = @badge_no,
      theme_mode = @theme_mode,
      color_palette = @color_palette,
      updated_at = @updated_at
    WHERE id = 1`
  ).run({
    officer_name: (b.officer_name || '').trim(),
    badge_no: (b.badge_no || '').trim(),
    theme_mode,
    color_palette,
    updated_at: nowIso(),
  });

  const s = getSettings();
  res.json({
    id: s.id,
    officer_name: s.officer_name,
    badge_no: s.badge_no,
    theme_mode: s.theme_mode,
    color_palette: s.color_palette,
    updated_at: s.updated_at,
  });
});

export default router;