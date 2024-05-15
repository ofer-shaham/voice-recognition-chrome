[![Netlify Status](https://api.netlify.com/api/v1/badges/ad488823-febb-49e2-8a6f-3c922474d39f/deploy-status)](https://app.netlify.com/sites/chrome-voice-recognition/deploys)

[Visit board!](https://github.com/users/ofer-shaham/projects/5)

```yaml
- run e2e test on ci

NEXT:
- 0. add state
- 1. full-screen mode:
- 1.0 - add button for reset language to english - use a confirmation dialog protection
- 1.0.0 allow sharing a full-screen state: sync full-screen mode with search params
- 1.0.1.0 dedicate space for both languages evenly - add vertical margin 
- 1.0.1.1 divide screen to 2 parts: border highlight when narrated
- 1.1 accesability: implement dark/light mode and use a better color pallete
- 1.2.0 present sentences using buttons: flexible font-size & spaces in-between buttons
- 1.2.0.1 speak a clicked word button
- 1.2.0.2 sentence click will trigger tts
- 1.3. history navigation: using a swapping gesture

- feature: repeatition game:
- collect words from historic sentences by clicking individual words
- collect few words and then trigger them by pronouncing them.
- highlight spoken word
- visualize as moving tags so that a sentence will be represented as tags which are attached by strings.

- 2. epic: multi-lingual translation:
- integrate redux and visualize the state
- sync params
- full-screen mode will be awesome


- 0. github action: e2e test with a simulated microphone
- fix recordings: pc mode
- language accordion: add a button which allow to quickly reset to english (it would enable the voice commands) 




done:
- show currently spoken text as highlighted
- show only source/target text: wrap text and highlight border when activated
- show only source/target text: hide all other buttons
- delay translation when a new sentence is being typed
- create git tag for ver 1.0.0: d1757935145bb14bea91ea3e82a4a73c3113aa9b -> deployed as branch ver1

later:
- support multiple translationBox
- multiple translaion boxes:
- once AI is employed - query AI regarding a word mutation accross languages and visualize it using a tree.

```