import { simulateRoi } from "../../services/api"

type RoiSimulationPayload = Parameters<typeof simulateRoi>[0]

export async function requestRoiSimulation(payload: RoiSimulationPayload) {
  return simulateRoi(payload)
}
