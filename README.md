# PrototypeDemo

This project is a basic declarative agent template created using Teams Toolkit. It demonstrates how to build a custom version of Copilot for specific scenarios, such as specialized knowledge, implementing specific processes, or saving time by reusing a set of AI prompts.

## Overview

With the declarative agent, you can create a custom Copilot that can be used for various scenarios. For example, a grocery shopping Copilot declarative agent can create a grocery list based on a meal plan you send to Copilot.

## Prerequisites

To run this app template on your local dev machine, you will need:

- [Node.js](https://nodejs.org/), supported versions: 18, 20
- A [Microsoft 365 account for development](https://docs.microsoft.com/microsoftteams/platform/toolkit/accounts)
- [Teams Toolkit Visual Studio Code Extension](https://aka.ms/teams-toolkit) version 5.0.0 and higher or [Teams Toolkit CLI](https://aka.ms/teamsfx-toolkit-cli)
- [Microsoft 365 Copilot license](https://learn.microsoft.com/microsoft-365-copilot/extensibility/prerequisites#prerequisites)

## Getting Started

1. Select the Teams Toolkit icon on the left in the VS Code toolbar.
2. In the Account section, sign in with your [Microsoft 365 account](https://docs.microsoft.com/microsoftteams/platform/toolkit/accounts) if you haven't already.
3. Create a Teams app by clicking `Provision` in the "Lifecycle" section.
4. Select `Preview in Copilot (Edge)` or `Preview in Copilot (Chrome)` from the launch configuration dropdown.
5. Once the Copilot app is loaded in the browser, click on the "…" menu and select "Copilot chats". You will see your declarative agent on the right rail. Clicking on it will change the experience to showcase the logo and name of your declarative agent.
6. Ask a question to your declarative agent, and it should respond based on the instructions provided.

## Project Structure

| Folder       | Contents                                                                                 |
| ------------ | ---------------------------------------------------------------------------------------- |
| `.vscode`    | VSCode files for debugging                                                               |
| `appPackage` | Templates for the Teams application manifest, the GPT manifest, and the API specification |
| `env`        | Environment files                                                                        |
| `demo_data`  | Sample data files for demonstration                                                      |
| `public`     | Public assets including media files                                                      |
| `scripts`    | Utility scripts                                                                          |
| `src`        | Source code files                                                                        |

## Key Files

| File                               | Contents                                                                     |
| ---------------------------------- | ---------------------------------------------------------------------------- |
| `appPackage/declarativeAgent.json` | Define the behavior and configurations of the declarative agent.             |
| `appPackage/manifest.json`         | Teams application manifest that defines metadata for your declarative agent. |
| `teamsapp.yml`                     | Main Teams Toolkit project file defining properties and configuration stages. |

## Demo Video

Watch the demo video to see the project in action:

![Copilot Demo](public/assets/CopilotDemo.mp4)

## Additional Information and References

- [Declarative agents for Microsoft 365](https://aka.ms/teams-toolkit-declarative-agent)
- [Teams Toolkit Visual Studio Code Extension Guide](https://github.com/OfficeDev/TeamsFx/wiki/Teams-Toolkit-Visual-Studio-Code-v5-Guide#overview)