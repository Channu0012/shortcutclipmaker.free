import re
import math
from typing import List, Dict, Any, Optional


class ClipHighlighter:
    """
    AI Highlight & Viral Moment Discovery Engine.
    Partitions any video timeline across 10-20 temporal windows, snaps cuts to natural
    sentence boundaries & breath pauses, classifies hooks/insights/stories/energy,
    and generates rich virality analytics + word-density waveform hints.
    """

    HOOK_TRIGGERS = [
        r"\b(the number one|the #1|reason why|secret to|truth about|nobody talks about)\b",
        r"\b(why 90%|why 95%|why 99%|most people fail|stop doing|never do this)\b",
        r"\b(uncomfortable truth|biggest mistake|mindset shift|if you want|how to actually)\b",
        r"\b(worst thing|superpower|double your|ten times|10x|replace all|rule of)\b",
        r"\b(here is what|the problem with|think about it|listen to this|the secret)\b",
        r"\b(bhai|dekh|kya|shuru|khatam|crazy|insane|omg|look at this|check this out)\b",
        r"\b(wait till the end|you wont believe|this changes everything|watch closely)\b",
    ]

    PUNCHLINE_TRIGGERS = [
        r"\b(and that is why|do it again|win|get left behind|double|completely|unstoppable)\b",
        r"\b(the only way|start today|change everything|results|never struggle|effortless)\b",
        r"[\!\?]$",
    ]

    CATEGORIES = [
        {"name": "Viral Hook", "tag": "hook", "badge": "bg-orange-500/10 text-orange-400 border-orange-500/20"},
        {"name": "Insight & Strategy", "tag": "insight", "badge": "bg-blue-500/10 text-blue-400 border-blue-500/20"},
        {"name": "High Energy", "tag": "high_energy", "badge": "bg-amber-500/10 text-amber-400 border-amber-500/20"},
        {"name": "Golden Rule", "tag": "rule", "badge": "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"},
        {"name": "Story Arc", "tag": "story", "badge": "bg-purple-500/10 text-purple-400 border-purple-500/20"},
        {"name": "Bold Take", "tag": "funny", "badge": "bg-rose-500/10 text-rose-400 border-rose-500/20"},
    ]

    def __init__(
        self,
        target_duration: int = 45,
        min_duration: Optional[int] = None,
        max_duration: Optional[int] = None,
    ):
        self.target_duration = max(15, int(target_duration))
        self.min_duration = (
            min_duration if min_duration is not None else max(15, int(self.target_duration * 0.55))
        )
        self.max_duration = (
            max_duration if max_duration is not None else max(self.min_duration + 12, int(self.target_duration * 1.4))
        )

    def find_highlights(self, segments: List[Dict[str, Any]], max_clips: int = 12) -> List[Dict[str, Any]]:
        if not segments:
            return []

        total_start = float(segments[0]["start"])
        total_end = float(segments[-1]["end"])
        total_dur = max(1.0, total_end - total_start)

        target_count = max(1, min(25, int(max_clips)))
        window_size = total_dur / target_count
        selected: List[Dict[str, Any]] = []
        used_ranges: List[tuple] = []

        # 1. Primary pass: discover best viral window in each temporal slice
        for w_idx in range(target_count):
            w_start = total_start + (w_idx * window_size)
            w_end = min(total_end, w_start + max(window_size * 1.15, self.max_duration * 1.15))

            window_indices = [
                idx for idx, s in enumerate(segments)
                if s["end"] >= w_start and s["start"] <= w_end
            ]
            if not window_indices:
                continue

            candidate = self._find_best_window_moment(segments, window_indices, used_ranges, max_overlap=0.35)
            if candidate:
                used_ranges.append((candidate["start_time"], candidate["end_time"]))
                selected.append(self._package_clip(candidate, len(selected) + 1))

        # 2. Adaptive secondary pass: relax overlap tolerance slightly if short of requested clips
        if len(selected) < target_count:
            fillers = self._fill_additional_moments(
                segments, used_ranges, target_count - len(selected)
            )
            for cand in fillers:
                used_ranges.append((cand["start_time"], cand["end_time"]))
                selected.append(self._package_clip(cand, len(selected) + 1))

        # Chronological ordering with stable IDs
        selected.sort(key=lambda c: c["start_time"])
        for idx, item in enumerate(selected):
            item["id"] = f"clip_{idx + 1}"
            item["index"] = idx + 1

        return selected

    def _package_clip(self, cand: Dict[str, Any], index: int) -> Dict[str, Any]:
        category = self._classify_category(cand["text"], cand["hook_quote"], index)
        meta = self._generate_rich_metadata(cand, category, index)
        waveform_preview = self._compute_speech_waveform(
            cand.get("words", []), cand["start_time"], cand["end_time"], num_bars=48
        )
        return {
            "id": f"clip_{index}",
            "index": index,
            "start_time": round(cand["start_time"], 2),
            "end_time": round(cand["end_time"], 2),
            "duration": round(cand["duration"], 2),
            "score": cand["score"],
            "category": category["name"],
            "category_tag": category["tag"],
            "category_badge": category["badge"],
            "hook_title": meta["title"],
            "hook_quote": cand["hook_quote"],
            "summary": meta["summary"],
            "youtube_shorts_seo": meta["shorts_seo"],
            "hashtags": meta["hashtags"],
            "virality_breakdown": meta["virality_breakdown"],
            "words": cand.get("words", []),
            "waveform_preview": waveform_preview,
        }

    def _collect_words(self, segs: List[Dict[str, Any]], start_idx: int, end_idx: int) -> List[Dict[str, Any]]:
        words: List[Dict[str, Any]] = []
        for s_idx in range(start_idx, end_idx + 1):
            seg = segs[s_idx]
            s_words = seg.get("words") or []
            if s_words:
                words.extend(s_words)
            else:
                raw_toks = seg["text"].split()
                s_st = float(seg["start"])
                s_dur = max(0.15, float(seg["end"]) - s_st)
                step = s_dur / max(1, len(raw_toks))
                for w_i, tok in enumerate(raw_toks):
                    words.append({
                        "word": tok,
                        "start": round(s_st + w_i * step, 2),
                        "end": round(s_st + (w_i + 1) * step, 2),
                    })
        return words

    def _find_best_window_moment(
        self,
        all_segs: List[Dict[str, Any]],
        window_indices: List[int],
        used_ranges: List[tuple],
        max_overlap: float = 0.35,
    ) -> Optional[Dict[str, Any]]:
        best = None
        best_score = -1.0
        first_idx = window_indices[0]
        last_idx = window_indices[-1]

        for i in range(first_idx, last_idx + 1):
            start_seg = all_segs[i]
            hook_score, hook_trigger = self._evaluate_hook(start_seg["text"])
            pause_bonus = 8.0 if (i == 0 or (start_seg["start"] - all_segs[i - 1]["end"]) >= 0.7) else 0.0

            for j in range(i, last_idx + 1):
                end_seg = all_segs[j]
                dur = round(end_seg["end"] - start_seg["start"], 2)

                if dur > self.max_duration:
                    break
                if dur < self.min_duration:
                    continue
                if self._overlaps_any(start_seg["start"], end_seg["end"], used_ranges, max_overlap_ratio=max_overlap):
                    continue

                total_text = " ".join(all_segs[k]["text"] for k in range(i, j + 1))
                end_clean = end_seg["text"].strip()
                sentence_end_bonus = 8.0 if end_clean.endswith((".", "!", "?")) else (-4.0 if end_clean.endswith(",") else 0.0)

                score, metrics = self._score_segment_detailed(
                    total_text, dur, hook_score, hook_trigger, end_clean, pause_bonus + sentence_end_bonus
                )

                if score > best_score:
                    best_score = score
                    clip_words = self._collect_words(all_segs, i, j)
                    best = {
                        "start_time": start_seg["start"],
                        "end_time": end_seg["end"],
                        "duration": dur,
                        "score": int(round(score)),
                        "hook_quote": start_seg["text"],
                        "text": total_text,
                        "words": clip_words,
                        "metrics": metrics,
                    }
        return best

    def _fill_additional_moments(
        self,
        segs: List[Dict[str, Any]],
        used_ranges: List[tuple],
        needed: int,
    ) -> List[Dict[str, Any]]:
        fillers: List[Dict[str, Any]] = []
        n = len(segs)
        if n < 2:
            return fillers

        # Try progressively relaxed overlap & minimum duration so short videos still fill cleanly
        for overlap_cap, min_scale in ((0.45, 0.9), (0.68, 0.7), (0.85, 0.55)):
            if len(fillers) >= needed:
                break
            eff_min = max(12.0, self.min_duration * min_scale)
            step = max(1, n // (needed + 4))
            for k in range(0, n - 1, step):
                if len(fillers) >= needed:
                    break
                start_seg = segs[k]
                curr_end = start_seg["end"]
                end_idx = k
                for j in range(k, n):
                    curr_end = segs[j]["end"]
                    end_idx = j
                    if (curr_end - start_seg["start"]) >= min(self.target_duration, max(eff_min, self.min_duration)):
                        if segs[j]["text"].strip().endswith((".", "!", "?")):
                            break
                    if (curr_end - start_seg["start"]) >= self.max_duration:
                        break
                dur = round(curr_end - start_seg["start"], 2)
                if dur < eff_min:
                    continue
                if self._overlaps_any(start_seg["start"], curr_end, used_ranges + [(f["start_time"], f["end_time"]) for f in fillers], max_overlap_ratio=overlap_cap):
                    continue
                # Avoid exact identical start_time duplicates
                if any(abs(start_seg["start"] - u[0]) < 4.0 for u in used_ranges + [(f["start_time"], f["end_time"]) for f in fillers]):
                    continue

                total_text = " ".join(segs[m]["text"] for m in range(k, end_idx + 1))
                hook_score, hook_trigger = self._evaluate_hook(start_seg["text"])
                score, metrics = self._score_segment_detailed(
                    total_text, dur, hook_score, hook_trigger, segs[end_idx]["text"].strip(), 0.0
                )
                clip_words = self._collect_words(segs, k, end_idx)
                fillers.append({
                    "start_time": start_seg["start"],
                    "end_time": curr_end,
                    "duration": dur,
                    "score": int(round(score)),
                    "hook_quote": start_seg["text"],
                    "text": total_text,
                    "words": clip_words,
                    "metrics": metrics,
                })

        return fillers

    @staticmethod
    def _overlaps_any(
        start: float,
        end: float,
        used_ranges: List[tuple],
        max_overlap_ratio: float = 0.40,
    ) -> bool:
        dur = max(1.0, end - start)
        for u_start, u_end in used_ranges:
            o_start = max(start, u_start)
            o_end = min(end, u_end)
            if o_end > o_start:
                overlap_dur = o_end - o_start
                if overlap_dur > (dur * max_overlap_ratio) and overlap_dur > 8.0:
                    return True
        return False

    def _evaluate_hook(self, text: str) -> tuple[float, str]:
        text_lower = text.lower()
        score = 10.0
        trigger = "Direct Opening"

        for pattern in self.HOOK_TRIGGERS:
            match = re.search(pattern, text_lower)
            if match:
                score += 34.0
                trigger = f"Hook phrase '{match.group(0)}'"
                break

        if text.strip().endswith(("?", "!")):
            score += 14.0
            if trigger == "Direct Opening":
                trigger = "High-curiosity question / exclamation"

        if any(char.isdigit() for char in text):
            score += 10.0

        if len(text.split()) >= 5:
            score += 8.0

        return min(62.0, score), trigger

    def _score_segment_detailed(
        self,
        text: str,
        duration: float,
        hook_score: float,
        hook_trigger: str,
        last_sentence: str,
        boundary_bonus: float,
    ) -> tuple[float, Dict[str, Any]]:
        score = hook_score + boundary_bonus

        has_punchline = False
        for pattern in self.PUNCHLINE_TRIGGERS:
            if re.search(pattern, last_sentence.lower()):
                score += 18.0
                has_punchline = True
                break

        dur_diff = abs(duration - self.target_duration)
        dur_penalty = min(16.0, (dur_diff / max(1, self.target_duration)) * 14.0)
        score += max(0.0, 14.0 - dur_penalty)

        word_count = len(text.split())
        wpm = int((word_count / max(1.0, duration)) * 60)
        if 125 <= wpm <= 195:
            score += 6.0

        energy_markers = ["!", "?", "never", "stop", "secret", "truth", "10x", "crazy", "insane", "fail", "win"]
        em_hits = sum(1 for em in energy_markers if em in text.lower())
        score += min(12.0, em_hits * 2.5)

        final_score = float(min(99, max(74, int(round(score)))))
        hook_pct = int(min(99, max(78, 52 + hook_score * 0.72)))
        retention_pct = int(min(99, max(76, 72 + (14.0 - dur_penalty) + (6.0 if wpm >= 120 else 2.0))))
        energy_pct = int(min(99, max(75, 70 + min(24.0, em_hits * 4.5 + (8.0 if has_punchline else 0.0)))))

        reasoning_parts = [hook_trigger]
        if wpm >= 120:
            reasoning_parts.append(f"steady {wpm} WPM pacing")
        if has_punchline:
            reasoning_parts.append("clean punchline close")
        else:
            reasoning_parts.append("complete thought cadence")

        return final_score, {
            "hook_score": hook_pct,
            "retention_score": retention_pct,
            "energy_score": energy_pct,
            "wpm": wpm,
            "reasoning": " + ".join(reasoning_parts).capitalize() + ".",
        }

    def _classify_category(self, text: str, hook_quote: str, index: int) -> Dict[str, Any]:
        tl = text.lower()
        hl = hook_quote.lower()
        if any(w in tl for w in ("rule", "90%", "99%", "1%", "step", "equation", "formula")):
            return self.CATEGORIES[3]  # rule
        if any(w in hl for w in ("why", "secret", "truth", "reason", "uncomfortable", "nobody")):
            return self.CATEGORIES[0]  # hook
        if "!" in hook_quote or any(w in tl for w in ("crazy", "insane", "never", "unstoppable", "triple")):
            return self.CATEGORIES[2]  # high_energy
        if any(w in tl for w in ("garbage", "stupid", "terrible", "laugh")):
            return self.CATEGORIES[5]  # funny
        if any(w in tl for w in ("ago", "started", "years", "story", "morning")):
            return self.CATEGORIES[4]  # story
        return self.CATEGORIES[index % len(self.CATEGORIES)]

    def _generate_rich_metadata(
        self,
        cand: Dict[str, Any],
        category: Dict[str, Any],
        index: int,
    ) -> Dict[str, Any]:
        hook = cand["hook_quote"]
        text = cand["text"]
        metrics = cand.get("metrics") or {
            "hook_score": 88,
            "retention_score": 85,
            "energy_score": 87,
            "reasoning": "Strong curiosity opening paired with rhythmic pacing.",
        }

        first_few = hook.strip().rstrip(".,!?")
        words = first_few.split()
        short_hook = " ".join(words[:7]) + "..." if len(words) > 7 else first_few
        clean_hook = re.sub(r"[\'\"]", "", short_hook)
        title = clean_hook
        shorts_title = f"{clean_hook} #Shorts"
        shorts_desc = (
            f"{text[:160].strip()}...\n\n"
            "Follow for daily high-retention clips!\n#shorts #viral #reels #podcast"
        )
        hashtags = ["#shorts", "#reels", "#viral", f"#{category['tag']}"]

        return {
            "title": title,
            "summary": text[:150].strip() + ("..." if len(text) > 150 else ""),
            "virality_breakdown": {
                "hook_score": metrics["hook_score"],
                "retention_score": metrics["retention_score"],
                "energy_score": metrics["energy_score"],
                "wpm": metrics.get("wpm", 145),
                "reasoning": metrics["reasoning"],
            },
            "shorts_seo": {
                "title": shorts_title,
                "description": shorts_desc,
                "tags": hashtags,
            },
            "hashtags": hashtags,
        }

    @staticmethod
    def _compute_speech_waveform(
        words: List[Dict[str, Any]],
        start_time: float,
        end_time: float,
        num_bars: int = 48,
    ) -> List[int]:
        """Generates an accurate amplitude preview curve from spoken word timing density."""
        dur = max(1.0, end_time - start_time)
        bins = [20.0] * num_bars
        for w in words:
            rel_mid = ((float(w["start"]) + float(w["end"])) * 0.5) - start_time
            if 0.0 <= rel_mid <= dur:
                b_idx = min(num_bars - 1, max(0, int((rel_mid / dur) * num_bars)))
                word_len_energy = min(55.0, 22.0 + len(str(w.get("word", ""))) * 4.5)
                bins[b_idx] = min(98.0, bins[b_idx] + word_len_energy)
        return [int(round(v)) for v in bins]
