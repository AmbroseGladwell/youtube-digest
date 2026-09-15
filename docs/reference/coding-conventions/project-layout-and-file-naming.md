# Project Layout, File Naming

For this project's actual naming and casing rules, see
`docs/conventions/naming-conventions.md` — that file is authoritative here. The
version of this file originally brought in described a different, incompatible
folder structure (nested page hierarchies, one `.testHelper.ts` per component)
from a different codebase; that structure has been dropped rather than kept
alongside a conflicting one.

One general idea from it is worth keeping on its own merits:

## Keep directories from growing unbounded

Within any single directory, avoid too many entries — as a rule of thumb, no
more than about 10. Break a directory up with subdirectories as it grows,
following the structure of the UI or feature itself rather than an arbitrary
split.
