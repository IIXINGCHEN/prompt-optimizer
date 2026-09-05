import core from './core'
import favorites from './favorites'
import prompt from './prompt'
import models from './models'
import templates from './templates'
import testing from './testing'
import context from './context'
import image from './image'
import video from './video'
import errors from './errors'

const messages = {
  ...core,
  ...favorites,
  ...prompt,
  ...models,
  ...templates,
  ...testing,
  ...context,
  ...image,
  ...video,
  ...errors,
} as const;

export default messages;
