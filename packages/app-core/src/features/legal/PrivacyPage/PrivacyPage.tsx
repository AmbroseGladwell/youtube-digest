import { Routes } from "../../../app/Routes.js";
import { LegalPage, type LegalSection } from "../LegalPage/LegalPage.js";
import { LegalTable } from "../LegalTable/LegalTable.js";
import { legalIdentity } from "../legalIdentity.js";

export const PRIVACY_POLICY_UPDATED_ON = "2026-11-13";

const { service, operator, country, contactEmail, minimumAge } = legalIdentity;

const contact = <a href={`mailto:${contactEmail}`}>{contactEmail}</a>;

// What the service collects, why, under which lawful basis, who handles it, for how long,
// and how to have it erased. Every claim here is checked against the build it describes;
// docs/features/legal-pages.md says which doc or code backs each section.
const sections: readonly LegalSection[] = [
  {
    id: "who-we-are",
    heading: "Who we are",
    body: (
      <>
        <p>
          {service} is run by {operator}, in {country}, and is the data controller for the personal data this policy describes. The service
          lives at {legalIdentity.site}, in the Chrome extension, and in the assistants you choose to connect.
        </p>
        <p>
          Questions, requests and complaints about your data go to {contact}. We answer within a month, as the law requires, and usually
          much sooner.
        </p>
      </>
    ),
  },
  {
    id: "in-short",
    heading: "The short version",
    body: (
      <ul>
        <li>
          Your library of overviews is yours. It lives on your device, and once you sign in it is synced to our server so your other devices
          can read it.
        </li>
        <li>We ask for an email address, and a first name if you want one, and nothing else about you. There is no password.</li>
        <li>When you bring your own API key, your device talks to that provider directly. The key never reaches us.</li>
        <li>
          Analytics count which features are used, never what you read, watch or type. Without an account you are asked first. With an
          account you can turn it off in Settings › Privacy.
        </li>
        <li>Error reports are always sent, so we can fix what breaks, and carry nothing you wrote or watched.</li>
        <li>We never sell your data, and we never show advertising.</li>
      </ul>
    ),
  },
  {
    id: "your-account",
    heading: "Your account and how you sign in",
    body: (
      <>
        <p>
          An account is an email address, a first name if you gave one, and the date it was made. You can change or remove the name, and
          move the account to a new address, from Settings. Signing in sends a one-time link to that address, through Brevo, our email
          provider. The link, and the code in the same email, work once and expire after fifteen minutes. We store only a hash of each,
          never the link itself. The extension signs in by typing a code from that link, which lasts ten minutes. Only creating an account
          makes one: an address with no account that asks to sign in is sent an email saying so, with a way to create one, and no link.
        </p>
        <p>
          Changing your email, or deleting your account, sends a code to your current address first, unless you signed in within the last
          fifteen minutes; changing your email then sends a code to the new address; each works once, for fifteen minutes, and only hashes
          are stored. When the account moves, the old address is told, with a link that moves it back for seven days; using that link also
          signs out every device. We keep a record of each change, as the two addresses and the times, so that link can work.
        </p>
        <p>
          Each device you sign in on gets a session, which lasts thirty days from the last time it was used. On the web app the session is a
          cookie, <strong>overview_session</strong>, which is strictly necessary and is the only cookie we set. In the extension the session
          is kept in the extension's own storage.
        </p>
        <p>
          <strong>Why and on what basis:</strong> to provide the service you asked for, which is performance of our contract with you.{" "}
          <strong>Kept:</strong> while the account exists. Links and codes stop working when they expire, and sessions when they lapse or
          you sign out.
        </p>
      </>
    ),
  },
  {
    id: "your-library",
    heading: "Your library",
    body: (
      <>
        <p>
          An overview is a note about a video, an article or a podcast episode: its big picture, claims, verdict, key points, the steps it
          gives, chapters and tags, plus the video's, page's or episode's title, link, channel, site or show and thumbnail or artwork link,
          and for an article up to five of the links the page makes, with their words and a line on why each is worth opening. For an
          episode it also keeps the address of its show's feed and audio, and the Apple Podcasts, Spotify or show page link you pasted, with
          the code Spotify adds to say who shared it removed; a shared link shows that link. Beside it you may add a reason you saved it,
          file it under topics, and mark it read or favourite. Your settings travel with the account too: the narration voice, whether
          cooking step by step reads the steps aloud, the cooking timer sound, theme and accent colour, which sections an overview shows,
          the About you sentence that personalises overviews and what we have learned from your overviews, the tags you have merged, the
          playlists you follow, and the running total of time saved with its milestones.
        </p>
        <p>
          Without an account all of this stays on the device. With an account it is synced to our server, in a database on Neon in London,
          so every device you sign in on reads the same library. We read it only to serve it back to you, to search it for you, to render
          narration, to serve a link you chose to share, and to answer an assistant you connected.
        </p>
        <p>
          <strong>Searching by meaning.</strong> With an account, we send each overview's big picture, claim and key points to OpenAI in the
          United States, once, to turn them into embeddings: lists of numbers that let a search find an overview by what it is about rather
          than by the words it uses. What you type into search, in the app or through an assistant you connected, goes to OpenAI the same
          way when it is searched by meaning. The embeddings are kept beside your library, are only ever compared with your own searches,
          and are made again when the overview changes. This happens whichever key wrote the overview.
        </p>
        <p>
          <strong>Basis:</strong> performance of our contract with you. <strong>Kept:</strong> until you delete the overview or the account.
        </p>
      </>
    ),
  },
  {
    id: "transcripts",
    heading: "Transcripts and articles",
    body: (
      <>
        <p>
          A video's overview is written from its captions. Your device fetches them, from YouTube or through a transcript provider you have
          a key for, and when the captions can't be had any other way our server fetches them itself, sometimes through a residential proxy
          run by Decodo. The proxy sees a request for the video's page and nothing about you.
        </p>
        <p>
          <strong>The shared transcript cache.</strong> A video's captions are the same for everyone, so when you make an overview of a
          video the captions behind it are sent to our server and may be served to the next reader of the same video, once a second account
          has fetched the same words. The stored copy carries no account. Separately, we keep a record that your account fetched that
          video's captions, which is what lets us count agreement between accounts and remove a bad copy. That record is kept for one year
          and then deleted, and it stays for that year even if you delete your account, because a copy you vouched for may still need
          removing.
        </p>
        <p>
          Captions the extension fetched only because a video was open in YouTube stay on your device and are never sent to us. Pressing
          Create asks our server whether it already holds a video's captions, so from that moment we know which video you are summarising;
          we log that a lookup happened, never the video.
        </p>
        <p>
          <strong>Articles.</strong> When you paste a link to an article on the web app, or regenerate an article's overview without the
          article open beside the extension, our server fetches the page, turns it into text and sends that text back to your device. We
          keep the overview and the page's title and address, never the article's text, and the link never appears in our logs. The overview
          may keep up to five of the links the article makes, each with the words it was linked by and a line on why it is worth opening,
          and these go with a shared link and to an assistant you connect. When the extension reads an article open in your own browser, our
          server never sees the page.
        </p>
        <p>
          <strong>Podcast episodes.</strong> When you paste a link to a podcast episode, our server reads the page it points to, looks the
          show up in Apple's podcast directory where it needs to, and reads the show's public feed to find the episode. It then looks for
          the episode's words: in our shared transcript cache, in a transcript the show publishes, or in the same episode on the show's
          YouTube channel. With the extension, that YouTube search runs in your own browser and our server checks the one video it found;
          without it, our server searches. Words found this way are public and the same for everyone, so they are kept in the shared
          transcript cache under the episode, with no account on them. Neither the link nor the episode ever appears in our logs. An episode
          whose words can't be found makes no overview.
        </p>
        <p>
          <strong>Basis:</strong> performance of our contract with you for your own transcripts, and our legitimate interest in serving
          every reader of a public video from one copy, and in tracing a wrong copy to the accounts that sent it, for the shared cache.
        </p>
      </>
    ),
  },
  {
    id: "writing-overviews",
    heading: "Writing an overview: whose key, and where the text goes",
    body: (
      <>
        <p>
          <strong>On your own key.</strong> If you add an API key from Anthropic, OpenAI, Google, DeepSeek, xAI or Mistral, the key is
          stored on the device you added it on and nowhere else. Your device sends the transcript or article, together with your About you
          sentence and what we have learned from your overviews, straight to that provider, under the provider's own terms and privacy
          policy. We are not in that path and never see the key, the request or the answer.
        </p>
        <p>
          <strong>On our key.</strong> When you have no key, or yours can't be used, the overview is written on our key: your device sends
          the transcript or article, your About you sentence and what we have learned from your overviews to our server, which sends them to
          OpenAI in the United States and returns the overview. The overview says when it was written this way. If you would rather your
          transcripts never went through us, turn on "Only ever use my key" in Settings › API keys. During onboarding, your first overview
          and the topic suggestions beside it are made on our key too, from the title, description and opening of the video or page.
        </p>
        <p>
          Your About you sentence and what we have learned from your overviews shape only How to apply, the section that suggests what you
          might do with the video. When your first overview is shown to you in onboarding, How to apply is also written once for anyone, so
          you can compare: the overview's title, channel, one-line premise, central claim and key points go to the provider whose key made
          the overview, and if that was our key, through our server to OpenAI. No transcript and nothing about you goes with them, and the
          result is kept only on your device. When a sample overview is saved into your account, its title, channel or site, premise and key
          points go through our server to OpenAI with the names and descriptions of your topics, to sort it into the ones it fits.
        </p>
        <p>
          Either way, a video's overview is written from its captions together with its title, channel and whole description, which is where
          a recipe video usually lists its ingredients. These are what YouTube shows anyone who opens the video.
        </p>
        <p>
          We count how many overviews each account makes in a month on each kind of key, and how many a device makes before it has an
          account. For a device without an account we keep a random trial token and a hashed form of the network address it came from, for
          seven days, so a limit can't be reset by opening a private window.
        </p>
        <p>
          We also keep a daily tally of what serving each account costs us, so we can price the plans fairly: for overviews and the smaller
          passes made on our key, the tokens used and their cost at OpenAI's list price, including attempts that failed; the tokens used to
          make your library and your searches searchable by meaning, and their cost; and the bytes fetched through our transcript proxy for
          you. It holds amounts only, never what was sent or found. What a device without an account costs is tallied with no device or
          account on it. Once a day PostHog copies a monthly summary of the tally for our cost dashboard: the month, your plan, what you
          cost and how many overviews and narrations you made, under a coded id that is neither your account's id nor the one analytics
          uses. When an account is deleted, the next day's copy leaves it out.
        </p>
        <p>
          <strong>Basis:</strong> performance of our contract with you. Counting and the cost tally are our legitimate interest in keeping
          the service affordable and fair.
        </p>
      </>
    ),
  },
  {
    id: "learning",
    heading: "What we learn from your overviews",
    body: (
      <>
        <p>
          After every third overview you make, a short pass looks at your recent overviews and proposes at most two short things about what
          you are working on, each with the overviews it came from ("From 4 overviews on app growth"). It sends your About you sentence,
          what has already been learned, what you removed, so it isn't proposed again, and, for your twelve newest overviews, the title,
          one-line premise, topic names and the reason you saved it. No transcripts are sent.
        </p>
        <p>
          It runs on the key that made the overview it follows. On your own key your device sends it straight to that provider, as with an
          overview. On our key it goes through our server to OpenAI in the United States, only when you are signed in, and isn't counted
          against your overviews; we log that a pass ran, what it cost and how long it took, never what it sent or found.
        </p>
        <p>
          Nothing learned is used until you have been shown it, by a notice on your library, with Undo, or in Settings › Personalisation.
          From then on it goes with each overview you make, beside your About you sentence, and is kept with your settings, on the device
          and, with an account, synced to our server. Settings › Personalisation shows everything learned and where it came from. Remove
          takes an item out, and Clear everything removes them all; a removed item's words stay in your settings, marked removed, so it is
          never learned again or sent with an overview. Turning off Keep learning stops the pass, while what is already held is still used
          until you remove it.
        </p>
        <p>
          <strong>Basis:</strong> performance of our contract with you. <strong>Kept:</strong> with your settings, until you delete the
          account.
        </p>
      </>
    ),
  },
  {
    id: "narration",
    heading: "Narration",
    body: (
      <>
        <p>
          Overviews can be read aloud. The audio is rendered by our own text-to-speech service on Fly.io and stored as a file on Cloudflare
          R2, named by a hash of the words and the voice, so two readers whose overviews contain the same words in the same voice share one
          file. The file can be fetched by anyone who holds its name, which isn't listed anywhere and isn't guessable; this is also how a
          shared link plays its narration without an account. We count renders per account per day, and keep each file for as long as an
          overview uses it, which for a file two readers share means while either does.
        </p>
        <p>
          <strong>Basis:</strong> performance of our contract with you.
        </p>
      </>
    ),
  },
  {
    id: "sharing",
    heading: "Shared links",
    body: (
      <>
        <p>
          Sharing an overview makes a public copy of it, readable by anyone who has the link, with no account. The copy holds the overview,
          the video's details, its transcript and its narration. It never holds your name, your reason for saving it, your topics, or your
          read and favourite marks. Search engines are asked not to index it. We count how many times the page is opened and nothing else
          about who opened it.
        </p>
        <p>
          Stop a link from the overview's menu or Settings › Shared links, and the page stops at once; a stopped link stays stopped, and
          sharing again makes a new one.
        </p>
      </>
    ),
  },
  {
    id: "analytics",
    heading: "Analytics",
    body: (
      <>
        <p>
          We count what is used so we know what to build and fix next. An event is a thing you did in the app, such as opening an overview,
          choosing a sort order or playing narration, with the choice you made, a count, or a random id of our own for the overview or
          topic. When an overview is made, or can’t be made, the event says whether it was on your key or ours, and names the provider and
          the model. An event can never carry a link, a video, a title, an overview's words or anything you typed, because there is no field
          shaped to hold them.
        </p>
        <h3>Three situations</h3>
        <ul>
          <li>
            <strong>No account, not yet asked.</strong> Onboarding asks on its second screen. Until you answer, events from the first screen
            are held in your browser's memory and are neither stored nor sent. Allow sends them; No thanks throws them away. Closing the
            page throws them away too.
          </li>
          <li>
            <strong>No account, said yes.</strong> Events are sent under a random id made on your device, which is kept in the browser or
            extension beside your answer. Turn analytics off in Settings › Privacy and the id is deleted. Signing out of an account also
            makes a new one, so the next person to use the device is never counted as you. Your basis here is consent.
          </li>
          <li>
            <strong>Signed in.</strong> Events are sent under your account's id, which is a random identifier and not your email. Our basis
            is legitimate interests: a small team learning which parts of the product earn their keep. You can turn it off for every device
            at once in Settings › Privacy, and our server then drops anything a device still sends.
          </li>
        </ul>
        <p>
          If you said yes before creating an account, your device sends its random id with the request, and the events counted under it are
          joined to the new account, so what you did before signing up is read as yours. An account that already existed is never joined
          this way.
        </p>
        <p>
          <strong>Where they go.</strong> Every event goes to our own server first, which checks it against a fixed catalogue and refuses
          anything else, then passes it to PostHog's EU cloud. No analytics script from any vendor runs in the app or the extension. PostHog
          places an event by network, from an address we cut short before sending, and then discards the address. We keep the country,
          region and city, and remove the postcode and coordinates.
        </p>
        <p>
          <strong>Kept:</strong> PostHog keeps events for up to a year. Events counted under a random id that was never joined to an account
          are kept for the same period today; we intend to delete them after thirty days and will update this policy when that is built. A
          shared link's page counts its visitors with an id that lives only while the page is open, unless the visitor is signed in, when
          the visit is counted under their account.
        </p>
      </>
    ),
  },
  {
    id: "errors",
    heading: "Error reports",
    body: (
      <>
        <p>
          When something breaks, the app sends us a report whether or not you have an account, because a bug that only shows up for people
          who opted in would never get fixed. A report carries the kind of error, its message with every link, email, quoted text and id
          replaced by a marker, where in our code it happened, the id of the request that failed, the app's version and your operating
          system, and the names of the last twenty things you did in the app. It never carries what you watched, read or typed. A signed-in
          reader's report is tied to their account id; anyone else's is tied to nothing.
        </p>
        <p>
          Reports go through our server to PostHog's error tracking, the same place as analytics, and our server and narration service
          report their own failures beside them.
        </p>
        <p>
          <strong>Basis:</strong> our legitimate interest in keeping the service working. <strong>Kept:</strong> up to a year, with the
          analytics.
        </p>
      </>
    ),
  },
  {
    id: "logs",
    heading: "Server logs and safety limits",
    body: (
      <>
        <p>
          Our server writes a log line for each request it handles, and ships those lines to PostHog's log store, where they are kept for
          fourteen days. A line names the route, the request's id, and, once known, the account and session it was for. It never holds your
          email, your network address, a link, a video id, a share link or any words from an overview. When an overview can’t be made on
          your own key because the model you chose was refused or kept answering in the wrong shape, the line names the provider and the
          model, so we can see which models fail; never what the provider said back. Finding the account behind an email is a database
          lookup, not a log search.
        </p>
        <p>
          To keep the service up and to stop abuse, we rate-limit requests by network address. Those counts live in the server's memory for
          at most a day. Two daily caps keep a hashed form of the address in the database for seven days: how many captions our server
          fetched for a device, and how many overviews and article and podcast link reads a device made before it had an account.
        </p>
        <p>
          <strong>Basis:</strong> our legitimate interest in running a reliable and safe service, and in answering a support request after
          the fact.
        </p>
      </>
    ),
  },
  {
    id: "assistants",
    heading: "Assistants you connect",
    body: (
      <p>
        You can connect Claude or another assistant to your library. The assistant gets its own tokens, never your session, and they let it
        list and search your overviews, by word and by meaning, read them and their transcripts, and mark them read or favourite. A
        connection whose consent screen said so can also read what we know about you: your About you sentence, and what we have learned from
        your overviews with where each came from, never anything you removed or have not yet been shown. That is on until you turn off
        "Share with your assistants" in Settings › Personalisation, which stops every connection reading it at once. Every connection is
        listed in Settings › Connections, where you can revoke it. We log each call an assistant makes, with the tool it used and how long
        it took, never the overview's contents or what we know about you. The assistant's own provider handles what it then does with what
        it reads under its own policy.
      </p>
    ),
  },
  {
    id: "processors",
    heading: "Who handles your data for us, and where",
    body: (
      <>
        <p>
          We use a small number of providers to run the service. Each acts on our instructions, under a contract that limits what it may do
          with the data.
        </p>
        <LegalTable
          caption="The providers that handle personal data on our behalf"
          columns={["Provider", "What it does", "Where"]}
          rows={[
            ["Fly.io", "runs our server and the narration service", "London"],
            ["Neon", "our database: accounts, libraries, transcripts, usage counts", "London"],
            ["Cloudflare", "stores narration audio (R2) and serves our domain's DNS", "Cloudflare's network"],
            ["PostHog", "analytics, error reports, server logs and the monthly cost summary", "EU cloud"],
            ["Brevo", "sends sign-in emails", "European Union"],
            [
              "OpenAI",
              "writes overviews, topic suggestions and what we learn from your overviews when made on our key, and turns your overviews' claims and your searches into embeddings for search",
              "United States",
            ],
            ["Decodo", "a proxy our server fetches captions through when YouTube refuses it directly", "varies"],
            [
              "YouTube (Google)",
              "answers our server's requests for a playlist's videos, and its searches for a podcast episode's video",
              "varies",
            ],
          ]}
        />
        <p>
          Watching a recipe video's step while cooking step by step loads YouTube's own player, in its privacy-enhanced mode, in your
          browser. YouTube sees that request and your network address, under Google's privacy policy. The request names the video and the
          part to play, and we add nothing about you.
        </p>
        <p>
          Playing a podcast episode inside its overview loads the episode's audio in your browser, from the address in the show's public
          feed. The show's host, and any service it uses to add adverts, sees that request and your network address, under its own policy,
          as it would in a podcast app. We add nothing about you.
        </p>
        <p>
          A provider you bring your own key for (Anthropic, OpenAI, Google, DeepSeek, xAI or Mistral) is not our processor. Your device
          sends to it directly, under the agreement between you and that provider.
        </p>
        <p>
          Where a provider is outside the United Kingdom, the transfer relies on the UK's adequacy regulations for the European Union, and
          for the United States on the provider's standard data protection clauses with the UK addendum.
        </p>
      </>
    ),
  },
  {
    id: "on-your-device",
    heading: "What is stored on your device",
    body: (
      <>
        <p>
          <strong>Strictly necessary</strong>, because the app can't work without it: your library and its transcripts, in the browser's
          database; any API keys you added; your settings; your sign-in state, and in the extension the server it talks to; where you got to
          in each transcript; which of a followed playlist's videos this device has seen; and, before you have an account, the trial token
          that lets you make a first overview.
        </p>
        <p>
          <strong>Analytics only</strong>, and deleted when you say no: your answer to the analytics question, the date you gave it, and,
          after a yes, the random id you are counted under. A no is stored so we don't ask again.
        </p>
        <p>Clearing the site's data in your browser, or removing the extension, removes all of it.</p>
      </>
    ),
  },
  {
    id: "retention",
    heading: "How long we keep things",
    body: (
      <LegalTable
        caption="Retention, by kind of data"
        columns={["What", "Kept for"]}
        rows={[
          ["Your account: email, first name", "until you delete the account"],
          ["Sessions", "30 days from last use, or until you sign out; gone with the account"],
          ["Sign-in links and codes", "15 and 10 minutes, as hashes"],
          [
            "Codes for changing your email, and the record of each change",
            "the codes 15 minutes, as hashes; the change itself with the account",
          ],
          ["Your library and settings", "until you delete the overview or the account"],
          ["What we learn from your overviews, and the items you removed", "with your settings, until you delete the account"],
          ["Embeddings of your overviews, for search", "until the overview changes or is deleted, or the account is"],
          [
            "Narration audio",
            "while an overview uses it; every file your account asked for goes with the account, and is made again for a reader who shared it the next time they play it",
          ],
          ["Shared links", "until you stop them; the copy goes with the account"],
          ["Transcripts linked to your account", "while a note of yours uses the video"],
          ["A shared cache copy, with no account on it", "until it is removed as wrong"],
          ["The record that your account fetched a video's captions", "one year, even after the account is deleted"],
          ["Monthly and daily usage counts, and the daily cost tally, for an account", "with the account"],
          [
            "The record of a deletion: the account's opaque id, the random analytics id joined to it, the narration files asked for, and how each erasure ended",
            "until every erasure it records is finished, and at most a year",
          ],
          ["Hashed addresses for the daily caps", "7 days"],
          ["Analytics events and error reports", "up to a year, at PostHog"],
          ["The monthly cost summary, at PostHog", "until the day after the account is deleted"],
          ["Server logs", "14 days"],
          ["Your email at Brevo, as the recipient of sign-in mail", "under Brevo's own retention for sent mail"],
        ]}
      />
    ),
  },
  {
    id: "your-rights",
    heading: "Your rights, and deleting your data",
    body: (
      <>
        <p>
          Under UK data protection law you can ask for a copy of your data, have it corrected or deleted, restrict or object to how we use
          it, and take it elsewhere. Write to {contact} from the address on your account.
        </p>
        <p>
          <strong>Deleting your account.</strong> Settings › Account & sync has Delete account. After a code to your address confirms it is
          you, skipped if you signed in within the last fifteen minutes, it deletes straight away and in one step: the account, its email
          and name, any email change in progress and the record of each change, every session and connected assistant, your library and
          settings, your shared links, the monthly and daily counts, the sign-in links held for your address, and every narration file your
          account asked for. Then we ask PostHog to delete the person records under your account's id and the random id joined to it at
          sign-up, with every event and error report under them; PostHog removes the person within minutes and the events in a later
          scheduled run, not instantly. If asking fails, we keep a record of the deletion saying so and ask again by hand. What stays is
          what the table above says outlives an account: the record that your account fetched a video's captions, for the rest of its year;
          the anonymous copies in the shared cache; and the record of the deletion itself, which holds no address. Server logs expire on
          their own within fourteen days. The device you deleted from removes its copy of your library; copies on other devices stay on
          those devices, signed out, until you clear the site's data there. Signing in with the same address afterwards finds no account;
          creating one with it starts a new, empty account.
        </p>
        <p>
          <strong>Without an account.</strong> Turning analytics off in Settings › Privacy deletes the random id from your device and stops
          anything more being sent. To have what was already sent erased, tell us the id, which the app keeps in your browser's storage
          under <strong>overview.analyticsConsent.v1</strong>.
        </p>
        <p>
          If you think we have handled your data wrongly, you can complain to the Information Commissioner's Office at{" "}
          <a href="https://ico.org.uk/">ico.org.uk</a>. We would rather hear from you first.
        </p>
      </>
    ),
  },
  {
    id: "children",
    heading: "Children",
    body: (
      <p>
        {service} is not for children under {minimumAge}, and we don't knowingly keep an account for anyone younger. If you think we have
        one, tell us and we will delete it.
      </p>
    ),
  },
  {
    id: "changes",
    heading: "Changes to this policy",
    body: (
      <p>
        When what we collect changes, this page changes with it and the date at the top moves. If a change matters to readers without an
        account, the app asks about analytics again before anything new is counted. If a change matters to account holders, we email the
        address on the account before it takes effect.
      </p>
    ),
  },
];

export function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy policy"
      updatedOn={PRIVACY_POLICY_UPDATED_ON}
      intro={
        <p>
          This is what {service} collects about you, why, and what happens to it. It is written to be read, so it says what the software
          actually does rather than what a policy usually says.
        </p>
      }
      sections={sections}
      otherPage={{ label: "Terms of service", to: Routes.terms() }}
    />
  );
}
