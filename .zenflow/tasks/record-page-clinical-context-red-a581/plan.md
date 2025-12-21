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
<!-- chat-id: 251f7cae-899c-4917-9227-0a1ae6a5548a -->

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

### [ ] Step: Verification

**Finding: Feature Already Implemented**

Upon comprehensive codebase analysis, all requested functionality is already implemented. This step verifies the existing implementation.

1. Run tests and linters to confirm no regressions
2. Perform manual verification of the Record page workflow
3. Write report to `{@artifacts_path}/report.md` documenting findings

**Verification Checklist:**
- [ ] `npm run test` passes
- [ ] `npm run lint` passes
- [ ] `npm run type-check` passes
- [ ] Record page displays 4-section layout (context, materials, uploads, recording)
- [ ] Patient selector works (search, recent, inline creation)
- [ ] Referrer selector works
- [ ] CC recipients can be added/removed
- [ ] Letter type and template selection works
- [ ] Previous materials panel fetches and displays patient's letters/documents
- [ ] Document uploads work (drag-drop, file picker, camera)
- [ ] Recording mode selector switches between Ambient/Dictation/Upload
- [ ] Recording controls disabled until context is complete
