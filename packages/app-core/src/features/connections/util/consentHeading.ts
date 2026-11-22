export const CLIENT_NAME_LIMIT = 60;

export interface ConsentHeading {
  title: string;
  label: string;
  sub: string;
}

const quoted = (name: string) => `“${name}” wants to read your overviews`;

// The name is the assistant's own claim, so it is quoted, and a missing one is never filled in.
export const consentHeading = (clientName: string | null): ConsentHeading => {
  const name = clientName?.trim() ?? "";
  if (name === "") {
    const title = "An assistant wants to read your overviews";
    return { title, label: title, sub: "It didn’t give a name. Go by the address it sends you back to." };
  }
  const shown = name.length > CLIENT_NAME_LIMIT ? `${name.slice(0, CLIENT_NAME_LIMIT).trimEnd()}…` : name;
  return {
    title: quoted(shown),
    label: quoted(name),
    sub: "That’s the name it gave itself, and we can’t check it. Go by the address it sends you back to.",
  };
};
