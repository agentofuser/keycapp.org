import * as React from 'react'
import { Helmet } from 'react-helmet'
import Container from '@material-ui/core/Container'
import Typography from '@material-ui/core/Typography'
import TextareaAutosize from '@material-ui/core/TextareaAutosize'
import Box from '@material-ui/core/Box'
import { makeStyles } from '@material-ui/styles'
import { findFirst, zip } from 'fp-ts/es6/Array'
import Keypad from '../components/Keypad'
import { fold, Option } from 'fp-ts/es6/Option'
import { Paper, Theme } from '@material-ui/core'

const useStyles = makeStyles((theme: Theme) => ({
  mainGridContainer: {
    display: 'grid',
    gridTemplateColumns: '1fr',
    gridTemplateRows: '4fr 1fr',
    gridColumnGap: '16px',
    gridRowGap: '16px',
  },
  display: {
    display: 'grid',
    gridTemplateColumns: '1fr 2fr 1fr',
    gridColumnGap: '16px',
  },
  displayItem: {
    padding: theme.spacing(2, 2),
  },
  appStateViz: {
    width: '100%',
    border: 0,
  },
  outputBuffer: {
    padding: theme.spacing(2, 2),
  },
}))

const pushString = (str: string): AppReducer => (
  prevState: AppState,
  _action: AppAction
): AppState => {
  const nextState = prevState
  nextState.currentBuffer = prevState.currentBuffer + str
  return nextState
}

const mapLastWord = (mapWord: (word: string) => string): AppReducer => (
  prevState: AppState,
  _action: AppAction
): AppState => {
  const nextState = prevState
  nextState.currentBuffer = prevState.currentBuffer.replace(
    /\w+$/,
    (lastWord: string): string => mapWord(lastWord)
  )
  return nextState
}

const deleteChunkBackwards: AppReducer = (prevState, _action): AppState => {
  const nextState = prevState
  nextState.currentBuffer = prevState.currentBuffer.replace(/\s*\S+\s*$/, '')
  return nextState
}

const allKeyswitches: Keyswitch[] = [
  { key: 'a' },
  { key: 's' },
  { key: 'd' },
  { key: 'f' },
  { key: 'j' },
  { key: 'k' },
  { key: 'l' },
  { key: ';' },
]

const allCommands: Command[] = [
  {
    legend: 'write newline',
    instruction: pushString('\n'),
  },
  {
    legend: 'write space',
    instruction: pushString(' '),
  },
  {
    legend: "write '🧢'",
    instruction: pushString('🧢'),
  },
  {
    legend: "write 'o'",
    instruction: pushString('o'),
  },
  {
    legend: "write 'k'",
    instruction: pushString('k'),
  },
  {
    legend: 'upcase word',
    instruction: mapLastWord((word: string): string => word.toUpperCase()),
  },
  {
    legend: 'downcase word',
    instruction: mapLastWord((word: string): string => word.toLowerCase()),
  },
  {
    legend: 'delete word',
    instruction: deleteChunkBackwards,
  },
]

function loadBalancer(keyswitches: Keyswitch[], commands: Command[]): Layout {
  const keybindings = zip(keyswitches, commands)
  console.log({ keybindings })

  return new Map(keybindings)
}

type Legend = React.ReactNode
type Instruction = AppReducer

export interface Keyswitch {
  key: React.Key
}

export interface Command {
  legend: Legend
  instruction: Instruction
}

export type Keybinding = [Keyswitch, Command]

export type Layout = Map<Keyswitch, Command>

export interface AppAction {
  type: string
  data: {
    timestamp: number
    keyswitch: Keyswitch
    command: Command
  }
}

type AppActionLog = AppAction[]

interface AppState {
  appActionLog: AppActionLog
  currentBuffer: string
  currentLayout: Layout
}

type AppReducer = React.Reducer<AppState, AppAction>

const logAction: AppReducer = (prevState, action): AppState => {
  const newState = {
    appActionLog: [action, ...prevState.appActionLog],
    currentBuffer: prevState.currentBuffer,
    currentLayout: prevState.currentLayout,
  }

  return newState
}

function appReducer(prevState: AppState, action: AppAction): AppState {
  let mutatedState = prevState
  mutatedState = logAction(mutatedState, action)
  const { instruction } = action.data.command
  mutatedState = instruction(mutatedState, action)
  return mutatedState
}

export default function App(): React.ReactNode {
  const [state, dispatch] = React.useReducer(appReducer, {
    appActionLog: [],
    currentBuffer: '',
    currentLayout: loadBalancer(allKeyswitches, allCommands),
  })

  function onKeyUp(event: KeyboardEvent): void {
    event.stopPropagation()
    event.preventDefault()
    const keybinding: Option<Keybinding> = findFirst(
      ([keyswitch, _command]: Keybinding): boolean =>
        keyswitch.key === event.key
    )(Array.from(state.currentLayout.entries()))

    fold(
      (): void => {},
      ([keyswitch, command]: Keybinding): void =>
        dispatch({
          type: 'KeyswitchUp',
          data: {
            timestamp: Date.now(),
            keyswitch,
            command,
          },
        })
    )(keybinding)
  }

  React.useEffect(() => {
    window.addEventListener('keyup', onKeyUp)

    return () => {
      window.removeEventListener('keyup', onKeyUp)
    }
  })

  const classes = useStyles()
  return (
    <React.Fragment>
      <Helmet title="#Keykapp🧢"></Helmet>
      <Container maxWidth="lg">
        <Box my={4}>
          <Typography variant="h5" component="h1" gutterBottom>
            #Keykapp🧢
          </Typography>
          <div className={classes.mainGridContainer}>
            <div className={classes.display}>
              <Paper className={classes.displayItem}>
                <Typography>commandNgrams</Typography>
              </Paper>
              <Paper className={classes.outputBuffer}>
                <pre
                  style={{
                    fontFamily: 'monospace',
                    fontSize: '16px',
                    margin: 0,
                  }}
                >
                  {state.currentBuffer}
                </pre>
              </Paper>
              <Paper className={classes.displayItem}>
                <Typography>
                  appState
                  <br />
                  <TextareaAutosize
                    className={classes.appStateViz}
                    rowsMax={42}
                    value={JSON.stringify(state, null, 2)}
                  ></TextareaAutosize>
                </Typography>
              </Paper>
            </div>
            <Keypad dispatch={dispatch} layout={state.currentLayout} />
          </div>
        </Box>
      </Container>
    </React.Fragment>
  )
}
