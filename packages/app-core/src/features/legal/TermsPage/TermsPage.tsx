import { Routes } from "../../../app/Routes.js";
import { LegalPage, type LegalSection } from "../LegalPage/LegalPage.js";
import { legalIdentity } from "../legalIdentity.js";

export const TERMS_UPDATED_ON = "2026-11-09";

const { service, operator, country, contactEmail, governingLaw, minimumAge } = legalIdentity;

const contact = <a href={`mailto:${contactEmail}`}>{contactEmail}</a>;

// The terms a reader agrees to by creating an account, in plain words. The product facts
// they rest on are the ones docs/features/legal-pages.md lists.
const sections: readonly LegalSection[] = [
  {
    id: "what-this-is",
    heading: "What this is",
    body: (
      <>
        <p>
          {service} turns a YouTube video or an article into a short, blunt overview: what it claims, whether it holds up, and whether you
          should watch or read the original anyway. It can read the overview aloud, keep your overviews in a library that follows you
          between devices, share one with a link, and hand your library to an assistant you connect.
        </p>
        <p>
          The service is provided by {operator}, in {country}. These terms are the agreement between you and us. By creating an account you
          accept them, together with the <a href={Routes.privacy()}>privacy policy</a>, which says what we do with your data. If you don't
          accept them, don't create an account.
        </p>
      </>
    ),
  },
  {
    id: "overviews",
    heading: "Overviews are written by a model, and can be wrong",
    body: (
      <>
        <p>
          Every overview is written by an AI model from a transcript or an article's text. The verdict is meant to be blunt, and the model
          can be wrong about what a video says, misjudge it, or miss what mattered. An overview is a way to decide what to spend your time
          on. It isn't advice, and it isn't a substitute for the original where the original matters to you.
        </p>
        <p>
          The service is provided as it is, and as it is available. We don't promise that an overview is accurate or complete, that every
          video can be summarised, or that the service will always be up.
        </p>
      </>
    ),
  },
  {
    id: "your-account",
    heading: "Your account",
    body: (
      <ul>
        <li>You must be at least {minimumAge} to create an account.</li>
        <li>
          One account per person. An account belongs to the person who controls its email address, and signing in happens through that
          address, so keep it secure. Anyone who can read your email can sign in as you.
        </li>
        <li>Don't share an account, make accounts for other people, or make several accounts to get round a limit.</li>
        <li>
          You can delete your account at any time from Settings › Account & sync, after a code to your address confirms it is you. The
          privacy policy says what is deleted and what is kept.
        </li>
        <li>
          We may suspend or close an account that breaks these terms, is used to attack the service or other readers, or that we are
          required by law to close. Where we can, we will tell you why and give you a chance to put it right.
        </li>
      </ul>
    ),
  },
  {
    id: "your-own-keys",
    heading: "Your own API keys",
    body: (
      <>
        <p>
          You can write overviews on your own API key from Anthropic, OpenAI, Google, DeepSeek, xAI or Mistral, and fetch transcripts
          through a provider you hold a key for. When you do, your device talks to that provider directly. What you send, what it costs and
          what the provider does with it are governed by your agreement with that provider, not by us, and the cost is yours.
        </p>
        <p>
          A key you add stays on the device you added it on. Keep it to yourself: we can't recover a key you lose or revoke one that is
          misused, and we never see it.
        </p>
      </>
    ),
  },
  {
    id: "on-our-key",
    heading: "Overviews on our key, and limits",
    body: (
      <>
        <p>
          Every account can make a number of overviews each month on our own key, and a larger number on a key of its own. The numbers, and
          the daily caps that keep the service safe, are shown in the app with the date they reset. They are allowances, not entitlements:
          we may change them, and we may pause overviews on our key when a day's shared budget is spent.
        </p>
        <p>
          <strong>Paid plans.</strong> Nothing is charged for today. When paid plans are offered, the price, what it buys, how to cancel and
          how refunds work will be set out here and in the app before anything is charged, and these terms will be updated.
        </p>
      </>
    ),
  },
  {
    id: "acceptable-use",
    heading: "What you may not do",
    body: (
      <ul>
        <li>Use the service for anything unlawful, or to summarise content you have no right to access.</li>
        <li>
          Interfere with the service: probe it, overload it, work around a rate limit or a quota, automate sign-in, or send our server
          anything it didn't ask for.
        </li>
        <li>
          Upload a transcript that isn't the video's own captions. Transcripts you contribute may be served to other readers, and a false
          one would mislead everyone who reads that video next.
        </li>
        <li>Use a shared link to pass off someone else's video, or an overview of it, as your own work.</li>
        <li>Resell the service, or scrape or copy it for another product.</li>
      </ul>
    ),
  },
  {
    id: "your-content",
    heading: "Your content, and what you let us do with it",
    body: (
      <>
        <p>
          Your overviews, the reasons you save them, your topics and tags, your settings and the About you sentence are yours. We claim no
          ownership of them. So that the service can work, you give us permission to store them, sync them between your devices, render them
          as audio, serve them to an assistant you connect, and, when you share a link, serve the shared copy to anyone who holds it. That
          permission lasts as long as the content is on the service, and ends when you delete it or your account, except as the privacy
          policy says about shared transcripts.
        </p>
        <p>
          A video's captions and an article's text belong to whoever made them. The service reads them to write an overview, and shares a
          video's captions with other readers of the same video, on the footing that they are the public text of a public video. You are
          responsible for only summarising what you are allowed to read.
        </p>
        <p>
          The app, its design, its prompts and its name are ours, and these terms don't give you any right to them beyond using the service.
        </p>
      </>
    ),
  },
  {
    id: "sharing",
    heading: "Sharing a link",
    body: (
      <p>
        A shared link gives anyone who holds it a copy of your overview, with the video's details, its transcript and its narration, and
        without your name. It shares the overview, not the video. You choose what to share and who to send it to; we don't list shared pages
        anywhere and ask search engines not to index them. You can stop a link at any time, and a stopped link stays stopped.
      </p>
    ),
  },
  {
    id: "assistants",
    heading: "Assistants",
    body: (
      <p>
        Connecting an assistant lets it read your library and what we know about you, and mark overviews on your behalf. You can stop it
        reading what we know about you in Settings › Personalisation. What the assistant does with what it reads is between you and the
        assistant's provider. You can revoke a connection at any time in Settings › Connections.
      </p>
    ),
  },
  {
    id: "third-parties",
    heading: "YouTube and other third parties",
    body: (
      <p>
        {service} is not affiliated with YouTube or Google, or with any provider you bring a key for. Watching a video, following a playlist
        and reading a page happen under those sites' own terms. If a site withdraws something, or stops the service reading it, the service
        may stop working for that content, and that is not a failure on our part.
      </p>
    ),
  },
  {
    id: "changes-to-the-service",
    heading: "Changes to the service",
    body: (
      <p>
        The service is small and changes often. We may add, change or remove features, change limits, or stop the service altogether. If we
        stop it, we will give account holders notice by email and time to export their library, and we will delete what we hold as the
        privacy policy says.
      </p>
    ),
  },
  {
    id: "liability",
    heading: "Liability",
    body: (
      <>
        <p>
          Nothing in these terms limits liability that can't be limited by law, including for death or personal injury caused by negligence,
          or for fraud.
        </p>
        <p>
          Otherwise, we aren't liable for any loss that comes from relying on an overview, from the service being unavailable or losing
          data, from a provider you brought a key for, or from anything outside our reasonable control. If we are liable to you for anything
          else, our liability is limited to the amount you paid us in the twelve months before the claim, which while nothing is charged is
          nothing.
        </p>
        <p>
          The service is for personal use. If you use it for business, you accept it on the same terms, and we aren't liable for loss of
          profit, business or goodwill.
        </p>
      </>
    ),
  },
  {
    id: "changes-to-these-terms",
    heading: "Changes to these terms",
    body: (
      <p>
        When these terms change, the date at the top moves. For a change that affects your rights or what you can do with the service, we
        email the address on your account at least fourteen days before it takes effect. Carrying on using the service after that date is
        accepting the new terms; if you don't accept them, delete your account before then.
      </p>
    ),
  },
  {
    id: "law",
    heading: "Governing law",
    body: (
      <p>
        These terms are governed by the law of {governingLaw}, and the courts of {governingLaw} have jurisdiction over any dispute about
        them. If you live elsewhere in the United Kingdom or in the European Union, you keep any protection the law of your own country
        gives you that can't be taken away by agreement.
      </p>
    ),
  },
  {
    id: "contact",
    heading: "Contact",
    body: <p>Write to {contact} about anything in these terms.</p>,
  },
];

export function TermsPage() {
  return (
    <LegalPage
      title="Terms of service"
      updatedOn={TERMS_UPDATED_ON}
      intro={
        <p>
          These are the terms you agree to when you create an account with {service}. They are short on purpose, and they mean what they
          say.
        </p>
      }
      sections={sections}
      otherPage={{ label: "Privacy policy", to: Routes.privacy() }}
    />
  );
}
