# Spec and build

## Configuration
- **Artifacts Path**: {@artifacts_path} → `.zenflow/tasks/{task_id}`

---

## Agent Instructions

Ask the user questions when anything is unclear or needs their input. This includes:
- Ambiguous or incomplete requirements
- Technical decisions that affect architecture or user experience
- Trade-offs that require business context

Do not make assumptions on important decisions — get clarification first.

---

## Workflow Steps

### [x] Step: Technical Specification
<!-- chat-id: f870b88d-e3bd-461d-b2e6-24c89e782492 -->

Assess the task's difficulty, as underestimating it leads to poor outcomes.
- easy: Straightforward implementation, trivial bug fix or feature
- medium: Moderate complexity, some edge cases or caveats to consider
- hard: Complex logic, many caveats, architectural considerations, or high-risk changes

Create a technical specification for the task that is appropriate for the complexity level:
- Review the existing codebase architecture and identify reusable components.
- Define the implementation approach based on established patterns in the project.
- Identify all source code files that will be created or modified.
- Define any necessary data model, API, or interface changes.
- Describe verification steps using the project's test and lint commands.

Save the output to `{@artifacts_path}/spec.md` with:
- Technical context (language, dependencies)
- Implementation approach
- Source code structure changes
- Data model / API / interface changes
- Verification approach

If the task is complex enough, create a detailed implementation plan based on `{@artifacts_path}/spec.md`:
- Break down the work into concrete tasks (incrementable, testable milestones)
- Each task should reference relevant contracts and include verification steps
- Replace the Implementation step below with the planned tasks

Rule of thumb for step size: each step should represent a coherent unit of work (e.g., implement a component, add an API endpoint, write tests for a module). Avoid steps that are too granular (single function).

Save to `{@artifacts_path}/plan.md`. If the feature is trivial and doesn't warrant this breakdown, keep the Implementation step below as is.

---

### [x] Step: Create STATUS-20251222.md
<!-- chat-id: bb90733a-f524-4904-9037-82a0db4509c0 -->

Create `docs/status/STATUS-20251222.md` with:
- List of all routes and their purpose
- API endpoint inventory
- Key features implemented
- Flows fully wired (UI + Backend + Auth0)
- Known gaps and tech debt

---

### [ ] Step: Create docs/roadmap.md

Create `docs/roadmap.md` with sections:
- **MVP** - Core features
- **v1.1** - Enhancements
- **Backlog** - Future work

Include subsections:
- Done
- In progress (open branches/PRs)
- Not started

---

### [ ] Step: Commit and Create PR

1. Commit `docs/status/STATUS-20251222.md` and `docs/roadmap.md`
2. Push branch to origin
3. Create PR into main
4. Write report to `{@artifacts_path}/report.md`
