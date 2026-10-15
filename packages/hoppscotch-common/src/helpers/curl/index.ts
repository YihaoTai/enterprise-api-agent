import { flow } from "fp-ts/function"
import * as O from "fp-ts/Option"
import { cloneDeep } from "lodash-es"
import { parseCurlCommand } from "./curlparser"
import { generateCode } from "~/helpers/new-codegen"
import { HoppRESTRequest } from "@hoppscotch/data"

export const parseCurlToHoppRESTReq = flow(parseCurlCommand, cloneDeep)

export const hoppRESTReqToCurl = (req: HoppRESTRequest): string => {
  const result = generateCode("curl-native", req)
  if (O.isSome(result)) {
    return result.value
  }
  return ""
}
