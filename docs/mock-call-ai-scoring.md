# Mock Call AI Scoring Contract

Use this shape when the Vapi end-of-call report is sent to n8n/OpenAI and written back to `sbp_setter_mock_calls.structured_output`.

The admin dashboard renders `objection_moments` as first-class review cards so the reviewer can see what the prospect said, what the applicant said back, and why the response was strong or weak.

## Required JSON

```json
{
  "overall_score": 0,
  "tier": "strong_fit | coachable | nice_follow_up_loop | low_fit",
  "summary": "Short internal-only hiring read.",
  "advisor_brains": ["Daniel G NRS", "Josh Lyons Self-Actualized Selling"],
  "scores": {
    "appointment_control": 0,
    "objection_handling": 0,
    "belief_shift": 0,
    "rapport": 0,
    "listening": 0,
    "judgment": 0,
    "next_step_ask": 0
  },
  "objection_moments": [
    {
      "timestamp": "00:42",
      "label": "send_me_information_brush_off",
      "score": 0,
      "objection": "Prospect's exact objection or brush-off line.",
      "candidate_response": "Applicant's exact response from the transcript.",
      "judgment": "Why this response helped or hurt appointment control.",
      "recommended_move": "What a stronger setter would have done next.",
      "advisor_lens": "Daniel G / Josh Lyons framework note."
    }
  ],
  "flags": [
    "accepted_brush_off",
    "nice_follow_up_loop",
    "failed_to_ask_for_appointment"
  ],
  "strengths": [
    "Calm tone",
    "Clear intro"
  ],
  "coaching_notes": [
    "Push through polite brush-offs by isolating the real objection before offering to send details."
  ]
}
```

## Judging Notes

Reward applicants who calmly recognize brush-offs like “send me information” or “let me think about it,” isolate the real objection, create a small belief shift, and ask for the next step.

Penalize applicants who accept the brush-off at face value, ask when to follow up, send information without controlling the conversation, sound robotic, or avoid asking for the appointment.

The applicant must never see this scorecard. Only store it in the admin-facing database fields.
