const PlayerTemplate = `<div id="item-{0}-player" class="overlay-item-child noselect nopointer" />`;
const GameTemplate = `<div id="item-{0}-game" class="overlay-item-child noselect nopointer game-container" />`;
const TextTemplate = "<pre id='item-{0}-text' class='overlay-item-child noselect nopointer' />";

const TwitchChatMessageTemplate = "<div class='twitch-chat-message'><b style='color: {0};'>{1}:</b> {2}</div>";
const EmoteTemplate = `<img class="emote-img" src="{0}" alt="{1}" title="">`;

const PollTemplate = `<div id="item-{0}-text" class="twitch-poll-container overlay-item-child noselect nopointer">
  <div class="twitch-poll" id="item-{0}-poll">
    <div class="twitch-poll-title" id="item-{0}-poll-title"></div>
    <hr>
    <div class="twitch-poll-timer" id="item-{0}-poll-timer"></div>
    <table class="twitch-poll-choice-container" id="item-{0}-poll-choice-container"></table>
    <div class="twitch-poll-vote-count" id="item-{0}-poll-vote-count"></div>
  </div>
</div>`;

const PollChoiceTemplate = `<tr>
  <td class="twitch-poll-choice-name">{0}. {1}</td>
</tr>
<tr>
  <td class="twitch-poll-choice-bar-container">
    <div class="twitch-poll-choice-bar" choice="{0}">
      <div class="twitch-poll-choice-bar-fill" style="width: 0%"></div>
      <div class="twitch-poll-choice-bar-label">0%</div>
    </div>
  </td>
</tr>`;

const PredictionTemplate = `<div id="item-{0}-text" class="twitch-pred-container overlay-item-child noselect nopointer">
  <div class="twitch-pred" id="item-{0}-pred">
    <div class="twitch-pred-title" id="item-{0}-pred-title"></div>
    <hr>
    <div class="twitch-pred-timer" id="item-{0}-pred-timer"></div>
    <table class="twitch-pred-outcome-container" id="item-{0}-pred-outcome-container"></table>
    <div class="twitch-pred-point-count" id="item-{0}-pred-point-count"></div>
  </div>
</div>`;

const PredictionOutcomeTemplate = `<tr>
  <td class="twitch-pred-outcome-name" outcome="{0}">{1}</td>
</tr>
<tr>
  <td class="twitch-pred-outcome-bar-container">
    <div class="twitch-pred-outcome-bar" outcome="{0}">
      <div class="twitch-pred-outcome-bar-fill" style="width: 0%"></div>
      <div class="twitch-pred-outcome-bar-label">0 points</div>
    </div>
  </td>
</tr>`;