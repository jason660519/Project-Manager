# ADR-005: Beta Testing Strategy — AI Personas vs. Real Users

> **Created Date**: 2026-05-12
> **Created By**: Jason (Project Lead)
> **Last Modified**: 2026-05-12
> **Modified By**: Jason
> **Status**: Accepted
> **Decision Maker**: Jason

---

## Background

Before launching DevPilot publicly, we need to test:

1. **User flows**: Can users complete key workflows?
2. **Pain points**: Where do users get stuck?
3. **Feedback**: What features are missing or confusing?
4. **Edge cases**: How does the app behave with unusual input?

Traditionally, this requires recruiting beta testers, coordinating schedules, and collecting feedback. For MVP, we face constraints:

- Small team (limited time to support external testers)
- Tight timeline (need feedback quickly)
- Diverse personas (need to test across different user types)

---

## Decision

**For MVP, use Claude AI personas to simulate user testing instead of recruiting real beta testers.**

### Testing Process

1. Create detailed persona prompts (solo dev, team lead, agent enthusiast)
2. Ask Claude to walk through complete user scenarios (01-user-scenarios.md)
3. Claude records confusion points, missing features, UI issues
4. Compile feedback into prioritized issue list
5. Fix critical issues before real beta testing

### Example Persona

```
You are Alex, a solo developer maintaining 5 active projects simultaneously.
You use Cursor with Claude Code as your primary development tool.
You're comfortable with terminal but prefer GUI tools when available.
You manage projects across GitHub and local configs.

Your task: Set up DevPilot with one of your projects, then dispatch a feature to Claude Code.

As you go through the flow, note:
- Where did you get confused?
- What wasn't obvious?
- What would make this smoother?
- Did anything break or behave unexpectedly?
```

---

## Rationale

### Advantages of AI Personas

| Advantage | Benefit |
|-----------|---------|
| **Speed** | Get feedback in hours, not weeks |
| **Coverage** | Test multiple personas without coordination |
| **Repeatability** | Run same test flow again after fixes |
| **Specificity** | AI can articulate exactly what's confusing |
| **Cost** | No recruitment or compensation needed |
| **Availability** | Test 24/7, no scheduling conflicts |

### Examples of AI Feedback

**Scenario 1: GitHub Integration**
```
"I pasted the GitHub URL, but it wasn't clear that:
1. I needed to create a personal token first
2. The token needed specific permissions
3. The URL format was case-sensitive

Suggestion: Add inline help text. Show example URL.
Show a 'Get token' link that opens GitHub settings."
```

**Scenario 2: Task Dispatch**
```
"The prompt preview is hard to read in the modal.
The text is small and doesn't wrap well.
I couldn't easily tell which variables were filled correctly.

Suggestion: 
- Larger modal, resizable
- Syntax highlighting for template variables
- 'Preview' button to render final prompt"
```

**Scenario 3: Error Handling**
```
"Agent process crashed silently. 
The app showed 'Process exit code: 1' but no error message.
I didn't know what went wrong or how to fix it.

Suggestion: Show stdout/stderr in a collapsible panel. 
Allow user to re-run with verbose logging."
```

---

## Testing Plan

### Phase 1: Persona Definition (2 hours)

Create 3-4 personas representing different user segments:

| Persona | Profile | Priority Use Cases |
|---------|---------|-------------------|
| **Alex** | Solo dev, 5 projects, Cursor user | Task dispatch, project setup |
| **Sam** | Tech lead, 10+ projects, team coordination | Multi-project dashboard, reporting |
| **Jordan** | AI enthusiast, exploring agents | GitHub integration, prompt customization |
| **Casey** | Ops engineer, CI/CD focus | Background tasks, error monitoring |

### Phase 2: Scenario Testing (4-6 hours)

For each persona, Claude walks through:

1. **Onboarding**: Create first project config
2. **GitHub Setup**: Connect a real GitHub repo
3. **Feature Import**: Parse a spec document
4. **Task Dispatch**: Send task to agent
5. **Monitoring**: Watch agent execute
6. **Reporting**: Generate progress report

### Phase 3: Feedback Compilation (2 hours)

Claude outputs:
- Pros (what worked well)
- Cons (what was confusing)
- Suggestions (how to improve)
- Priority issues (critical vs. nice-to-have)

### Phase 4: Issue Prioritization (1 hour)

Create GitHub issues from feedback:
- `critical`: Breaks workflow
- `important`: Impacts usability
- `nice-to-have`: Polish/optimization

---

## Evaluated Alternatives

### Option A: Real Beta Users (Early Adopters)

**Pros:**
- Authentic user experience
- Discovers real-world edge cases
- Builds early community

**Cons:**
- Recruitment and scheduling overhead
- Time zone differences
- Support burden (beta users need hand-holding)
- Slower turnaround (weeks vs. hours)
- Limited sample size (5-10 users max)

**Conclusion:** ⚠️ Recommended for post-MVP; too slow for MVP phase

### Option B: Automated Accessibility Testing

**Pros:**
- Fast, objective metrics
- Detects WCAG violations
- Runs continuously

**Cons:**
- Can't test user workflows
- Can't assess UX flow or mental model
- Doesn't catch usability issues

**Conclusion:** ⚠️ Complement, not replacement for testing

### Option C: Team Internal Testing Only

**Pros:**
- Fast, available immediately
- Full context

**Cons:**
- Limited perspective (team is too close to product)
- Misses beginner pain points
- Small sample size

**Conclusion:** ❌ Insufficient — too biased

### Option D: AI Personas (This ADR)

**Pros:**
- Fast (hours vs. weeks)
- Diverse perspectives
- Repeatable
- Cost-effective
- Can test extreme cases

**Cons:**
- AI might miss unexpected edge cases
- No real user environment issues (PATH, permissions, etc.)
- Limited to text feedback (can't see UI screenshots)
- May overstate or understate issues

**Conclusion:** ✅ Chosen — Best for MVP timing and cost

---

## Testing Execution

### Instructions to Claude

```
You are Alex, a solo developer. You've just downloaded DevPilot for the first time.

You want to:
1. Set up a GitHub project (use: https://github.com/user/my-app)
2. Parse a feature spec (I'll provide a Word doc transcript)
3. Dispatch a task to Claude Code
4. Check the execution status
5. Generate a progress report

As you go through each step:
- **Note confusion points**: Where did you pause?
- **Check completeness**: Was information clear and complete?
- **Test edge cases**: What happens if something fails?
- **Assess UX**: Was the flow logical and intuitive?

After completion, provide:
1. **Workflow Walkthrough** (narrative)
2. **Issues Found** (categorized by severity)
3. **Improvement Suggestions** (concrete UX suggestions)
4. **Overall Assessment** (1-5 stars, with context)
```

### Sample Feedback Output

```markdown
## Alex's DevPilot Testing Session

### Workflow Walkthrough
- ✅ Downloaded and installed cleanly
- ✅ First run showed setup wizard
- ⚠️ GitHub repo URL field didn't validate format (accepted garbage)
- ❌ After pasting GitHub URL, nothing happened for 2 minutes (no loading indicator)
- ⚠️ Got error "401 Unauthorized" with no explanation
- ✅ Retried after creating token, worked fine
- ✅ Task dispatch was intuitive

### Critical Issues
1. **Missing Loading Indicator**: No feedback during GitHub sync
2. **Poor Error Messages**: "401" doesn't tell user what's wrong
3. **Input Validation**: Accept any string for GitHub URL

### Important Issues
1. **Token Setup Not Obvious**: User should see "Need to create GitHub token?" prompt
2. **Modal Too Small**: Hard to read prompt preview on small screens
3. **No Back Button**: Can't go back after entering GitHub URL

### Nice-to-Have
- Syntax highlighting in prompt preview
- Support for GitHub Enterprise URLs
- Keyboard shortcuts for dispatch

### Overall: 7/10
Great foundation, but error handling and UX needs polish before launch.
```

---

## Limitations & Mitigations

| Limitation | Impact | Mitigation |
|------------|--------|-----------|
| AI can't test real env (PATH, perms) | Medium | Real testers for post-MVP |
| AI may miss unintuitive patterns | Medium | Hire UX tester pre-launch |
| Can't test with old OS versions | Low | Document compatibility upfront |
| No hardware performance testing | Low | Run on actual test devices |

---

## Success Criteria

- ✅ Each persona completes all 5 workflow steps
- ✅ Identify at least 5 distinct issues/improvements
- ✅ Issues categorized correctly (critical vs. important)
- ✅ Feedback is actionable (specific, not vague)
- ✅ Complete testing within 1 week
- ✅ Fix all critical issues before real beta

---

## Post-MVP Path

### Week 1-2 (After AI Persona Testing)
- Fix critical issues identified by Claude
- Internal team testing on actual macOS/Windows

### Week 3-4 (Real Beta Testing)
- Recruit 5-10 early adopter beta testers
- Run through same scenarios
- Collect feedback and iterate

### Week 5+ (Pre-Launch)
- Fix remaining usability issues
- Performance and stress testing
- Security audit
- Public launch

---

## Risks & Mitigation

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|-----------|
| AI persona testing too positive | Medium | Medium | Use critical persona (cynical user) |
| Miss real-world bugs | Medium | Medium | Real beta testing follows AI phase |
| Over-reliance on AI feedback | Low | Low | Combine with team testing |

---

## Consequences

**Positive:**
- Fast feedback loop (MVP ready in weeks, not months)
- Cost-effective testing (no recruiter fees)
- Diverse perspective (multiple personas)
- Repeatable baseline for future versions

**Negative:**
- May miss environment-specific issues
- Real users might have different mental models
- Requires post-MVP user validation

---

## Future Iterations

- **Automated regression testing**: Reuse persona scenarios after each build
- **Usability study**: Hire UX researcher for formal study
- **User interviews**: Monthly check-ins with beta users
- **Telemetry**: Collect usage data to identify pain points

---

## References

- [User Testing Best Practices](https://www.usertesting.com/)
- [Persona Development Guide](https://www.interaction-design.org/literature/article/personas-why-and-how-you-should-use-them)
- [MVP Testing Strategies](https://en.wikipedia.org/wiki/Minimum_viable_product#Testing)
- [AI-Assisted Testing](https://www.browserstack.com/guide/ai-testing)

---

## Change History

| Date       | Version | Modified By | Changes |
|------------|---------|------------|---------|
| 2026-05-12 | 1.0     | Jason      | Initial ADR creation |
