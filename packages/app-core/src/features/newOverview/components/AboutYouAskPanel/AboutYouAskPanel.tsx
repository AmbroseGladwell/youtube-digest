import { useEffect, useRef } from "react";
import { useNewOverviewRunController } from "../../NewOverviewRunContext.js";
import { useAboutYouAnswer } from "../../useAboutYouAnswer.js";
import {
  ABOUT_YOU_ASK_TITLE_ID,
  ABOUT_YOU_ASK_WHY_ID,
  AboutYouAsk,
  AboutYouAskFoot,
  AboutYouAskWaiting,
} from "../AboutYouAsk/AboutYouAsk.js";
import { aboutYouAskTestIds } from "../AboutYouAsk/AboutYouAskTestIds.js";
import styles from "./AboutYouAskPanel.module.scss";

// Design 356d: in place in the extension panel, the phone layout narrower, its foot fixed.
export const AboutYouAskPanel = () => {
  const { run, aboutYouAsk } = useNewOverviewRunController();
  const { asking, saving, continueWith, skip } = aboutYouAsk;
  const { answer, change, topicNames } = useAboutYouAnswer(asking);
  const title = useRef<HTMLHeadingElement | null>(null);

  useEffect(() => {
    title.current?.focus();
  }, []);

  if (asking === null) {
    return null;
  }
  return (
    <section
      className={styles.root}
      aria-labelledby={ABOUT_YOU_ASK_TITLE_ID}
      aria-describedby={ABOUT_YOU_ASK_WHY_ID}
      data-testid={aboutYouAskTestIds.sheet}
    >
      <div className={styles.body}>
        <AboutYouAskWaiting run={run} sourceKind={asking.sourceKind} />
        <AboutYouAsk answer={answer} topicNames={topicNames} titleRef={title} onChange={change} />
      </div>
      <div className={styles.foot}>
        <AboutYouAskFoot
          saving={saving}
          stacked
          onContinue={() => void continueWith(answer, topicNames)}
          onSkip={() => void skip("skip")}
        />
      </div>
    </section>
  );
};
