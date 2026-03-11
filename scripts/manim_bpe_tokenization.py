from manim import *


class BPETokenizationVisualization(Scene):
    COLORS = [BLUE, GREEN, ORANGE, PINK, TEAL, YELLOW, RED, PURPLE]

    def make_token_box(self, text, color=BLUE, font_size=28):
        txt = Text(text, font_size=font_size, color=WHITE)
        box = Rectangle(
            width=txt.width + 0.4, height=0.55,
            fill_color=color, fill_opacity=0.85, stroke_color=WHITE, stroke_width=1.5,
        )
        return VGroup(box, txt)

    def make_token_row(self, tokens, colors=None, font_size=28):
        colors = colors or self.COLORS
        boxes = VGroup(*[
            self.make_token_box(t, colors[i % len(colors)], font_size)
            for i, t in enumerate(tokens)
        ])
        boxes.arrange(RIGHT, buff=0.15)
        return boxes

    def construct(self):
        # ── Title ──
        title = Text("Byte Pair Encoding (BPE) Tokenization", font_size=36, color=YELLOW)
        subtitle = Text("How modern LLMs build their vocabulary", font_size=22, color=GREY_B)
        subtitle.next_to(title, DOWN, buff=0.25)
        self.play(Write(title), FadeIn(subtitle, shift=UP * 0.3))
        self.wait(1.5)
        self.play(FadeOut(title), FadeOut(subtitle))

        # ── Step 1: corpus and initial characters ──
        step1 = Text("Step 1 — Split corpus into characters", font_size=26, color=YELLOW).to_edge(UP)
        self.play(Write(step1))

        corpus_words = ["low", "lowest", "lower", "newer", "new"]
        corpus_label = Text("Corpus:", font_size=22, color=GREY_A).shift(UP * 2.3 + LEFT * 5)
        corpus_texts = VGroup(*[Text(w, font_size=22) for w in corpus_words]).arrange(RIGHT, buff=0.5)
        corpus_texts.next_to(corpus_label, RIGHT, buff=0.3)
        self.play(FadeIn(corpus_label), Write(corpus_texts))
        self.wait(0.5)

        # Represent each word as character tokens
        word_splits = [list(w) for w in corpus_words]
        word_rows = VGroup()
        for i, chars in enumerate(word_splits):
            label = Text(f"{corpus_words[i]}:", font_size=20, color=GREY_B)
            row = self.make_token_row(chars, font_size=22)
            label.next_to(row, LEFT, buff=0.3)
            word_rows.add(VGroup(label, row))
        word_rows.arrange(DOWN, buff=0.3, aligned_edge=LEFT).shift(DOWN * 0.3)
        self.play(FadeIn(word_rows, shift=DOWN * 0.3))
        self.wait(1.5)

        # ── Step 2: count pairs ──
        self.play(FadeOut(step1))
        step2 = Text("Step 2 — Count adjacent pairs across corpus", font_size=26, color=YELLOW).to_edge(UP)
        self.play(Write(step2))

        pair_data = [
            ("l o", 3), ("o w", 3), ("w e", 2), ("e s", 1),
            ("s t", 1), ("e r", 2), ("n e", 2),
        ]
        pair_entries = VGroup()
        for pair_str, freq in pair_data:
            entry = Text(f"({pair_str}): {freq}", font_size=20)
            pair_entries.add(entry)
        pair_entries.arrange(DOWN, buff=0.15, aligned_edge=LEFT).to_edge(RIGHT, buff=1).shift(DOWN * 0.2)
        pair_title = Text("Pair Frequencies", font_size=22, color=TEAL).next_to(pair_entries, UP, buff=0.2)
        self.play(Write(pair_title), FadeIn(pair_entries, shift=LEFT * 0.3))
        self.wait(0.8)

        # Highlight the top pair
        highlight = SurroundingRectangle(pair_entries[0], color=YELLOW, buff=0.08)
        top_note = Text("Most frequent!", font_size=18, color=YELLOW).next_to(highlight, RIGHT, buff=0.15)
        self.play(Create(highlight), Write(top_note))
        self.wait(1.5)

        # ── Step 3: first merge (l + o -> lo) ──
        self.play(FadeOut(step2), FadeOut(pair_entries), FadeOut(pair_title),
                  FadeOut(highlight), FadeOut(top_note))
        step3 = Text("Step 3 — Merge most frequent pair: l + o → lo", font_size=26, color=YELLOW).to_edge(UP)
        self.play(Write(step3))

        # Animate the merge for first word ("low" -> "lo", "w")
        merge_label = Text("Merge #1:  l + o  →  lo", font_size=24, color=GREEN).shift(UP * 1.5 + RIGHT * 2.5)
        self.play(Write(merge_label))

        word_splits = [["lo", "w"], ["lo", "w", "e", "s", "t"], ["lo", "w", "e", "r"],
                       ["n", "e", "w", "e", "r"], ["n", "e", "w"]]
        new_rows = VGroup()
        for i, chars in enumerate(word_splits):
            label = Text(f"{corpus_words[i]}:", font_size=20, color=GREY_B)
            row = self.make_token_row(chars, font_size=22)
            label.next_to(row, LEFT, buff=0.3)
            new_rows.add(VGroup(label, row))
        new_rows.arrange(DOWN, buff=0.3, aligned_edge=LEFT).shift(DOWN * 0.3)
        self.play(Transform(word_rows, new_rows))

        vocab_label = Text("Vocab: a-z + lo", font_size=20, color=TEAL).to_edge(DOWN)
        self.play(FadeIn(vocab_label))
        self.wait(1.5)

        # ── Merge #2: o + w -> ow ──
        self.play(FadeOut(step3), FadeOut(merge_label))
        step4 = Text("Step 4 — Next merge: lo + w → low", font_size=26, color=YELLOW).to_edge(UP)
        self.play(Write(step4))

        merge2 = Text("Merge #2:  lo + w  →  low", font_size=24, color=GREEN).shift(UP * 1.5 + RIGHT * 2.5)
        self.play(Write(merge2))

        word_splits = [["low"], ["low", "e", "s", "t"], ["low", "e", "r"],
                       ["n", "e", "w", "e", "r"], ["n", "e", "w"]]
        new_rows2 = VGroup()
        for i, chars in enumerate(word_splits):
            label = Text(f"{corpus_words[i]}:", font_size=20, color=GREY_B)
            row = self.make_token_row(chars, font_size=22)
            label.next_to(row, LEFT, buff=0.3)
            new_rows2.add(VGroup(label, row))
        new_rows2.arrange(DOWN, buff=0.3, aligned_edge=LEFT).shift(DOWN * 0.3)
        self.play(Transform(word_rows, new_rows2))

        self.play(Transform(vocab_label, Text("Vocab: a-z + lo + low", font_size=20, color=TEAL).to_edge(DOWN)))
        self.wait(1.5)

        # ── Merge #3: e + r -> er ──
        self.play(FadeOut(step4), FadeOut(merge2))
        step5 = Text("Step 4 — Next merge: e + r → er", font_size=26, color=YELLOW).to_edge(UP)
        self.play(Write(step5))

        merge3 = Text("Merge #3:  e + r  →  er", font_size=24, color=GREEN).shift(UP * 1.5 + RIGHT * 2.5)
        self.play(Write(merge3))

        word_splits = [["low"], ["low", "e", "s", "t"], ["low", "er"],
                       ["n", "e", "w", "er"], ["n", "e", "w"]]
        new_rows3 = VGroup()
        for i, chars in enumerate(word_splits):
            label = Text(f"{corpus_words[i]}:", font_size=20, color=GREY_B)
            row = self.make_token_row(chars, font_size=22)
            label.next_to(row, LEFT, buff=0.3)
            new_rows3.add(VGroup(label, row))
        new_rows3.arrange(DOWN, buff=0.3, aligned_edge=LEFT).shift(DOWN * 0.3)
        self.play(Transform(word_rows, new_rows3))

        self.play(Transform(vocab_label, Text("Vocab: a-z + lo + low + er", font_size=20, color=TEAL).to_edge(DOWN)))
        self.wait(1.5)

        # ── Step 5: final vocabulary ──
        self.play(*[FadeOut(m) for m in self.mobjects])

        final_title = Text("Final Vocabulary & Tokenization", font_size=30, color=YELLOW).to_edge(UP)
        self.play(Write(final_title))

        vocab_items = ["a-z (base)", "lo", "low", "er"]
        vocab_boxes = VGroup(*[self.make_token_box(v, self.COLORS[i], 22) for i, v in enumerate(vocab_items)])
        vocab_boxes.arrange(RIGHT, buff=0.25).shift(UP * 2)
        vl = Text("Learned tokens:", font_size=22, color=GREY_A).next_to(vocab_boxes, LEFT, buff=0.3)
        self.play(FadeIn(vl), FadeIn(vocab_boxes, shift=DOWN * 0.2))

        # Show final tokenizations
        final_words = {
            "low":    ["low"],
            "lowest": ["low", "e", "s", "t"],
            "lower":  ["low", "er"],
            "newer":  ["n", "e", "w", "er"],
            "new":    ["n", "e", "w"],
        }
        final_rows = VGroup()
        for word, toks in final_words.items():
            lbl = Text(f"{word} →", font_size=22, color=GREY_B)
            row = self.make_token_row(toks, font_size=22)
            count = Text(f"({len(toks)} tokens)", font_size=18, color=GREY_C)
            lbl.next_to(row, LEFT, buff=0.3)
            count.next_to(row, RIGHT, buff=0.3)
            final_rows.add(VGroup(lbl, row, count))
        final_rows.arrange(DOWN, buff=0.3, aligned_edge=LEFT).shift(DOWN * 0.3)
        self.play(FadeIn(final_rows, shift=UP * 0.3))
        self.wait(2)

        # ── Summary ──
        self.play(*[FadeOut(m) for m in self.mobjects])

        summary_lines = [
            "BPE builds vocabulary bottom-up from characters.",
            "More frequent subwords get their own tokens,",
            "making encoding efficient.",
        ]
        summary = VGroup(*[Text(line, font_size=26) for line in summary_lines])
        summary.arrange(DOWN, buff=0.3)
        box = SurroundingRectangle(summary, color=YELLOW, buff=0.4, corner_radius=0.15)
        self.play(Create(box), Write(summary))
        self.wait(3)
        self.play(FadeOut(summary), FadeOut(box))
